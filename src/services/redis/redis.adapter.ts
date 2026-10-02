import { invariant, refusal } from '../../../lint/refusal.js';
import type { ContainerOptions } from '../containers/container.port.js';
import { SERVICE_IMAGES } from '../containers/service-images.js';
import type { DatabasePort } from '../database.port.js';
import type { IsolationStrategy } from '../isolation.port.js';
import { loadPeer } from '../peer.js';
import type { ServiceHandle } from '../service.port.js';

export type RedisOptions = {
    /** Override image. */
    image?: string;
};

/** Index 0 is the container's own; every other is one (worker, service) pair's. */
const DATABASES = 256;

const SERVICES_PER_WORKER = 4;

/** Pool id `w` holds indexes `4w − 3` to `4w`; worker 0 (outside a pool) shares pool id 1's. */
const WORKERS = Math.floor((DATABASES - 1) / SERVICES_PER_WORKER);

const PAIR_INDEXES: ContainerOptions = {
    command: ['redis-server', '--databases', String(DATABASES)],
};

type Held = { holders: number; slot: number };

/** One worker id per process, so the pairs of every other worker are theirs. */
const slots = new Map<string, Map<string, Held>>();

function takeSlot(worker: string, service: string): number {
    const held = slots.get(worker) ?? new Map<string, Held>();
    slots.set(worker, held);
    const own = held.get(service);
    if (own !== undefined) {
        own.holders += 1;
        return own.slot;
    }
    const taken = new Set([...held.values()].map((pair) => pair.slot));
    let slot = 0;
    while (taken.has(slot)) {
        slot += 1;
    }
    held.set(service, { holders: 1, slot });
    return slot;
}

function freeSlot(worker: string, service: string): void {
    const held = slots.get(worker);
    const own = held?.get(service);
    if (own === undefined) {
        return;
    }
    own.holders -= 1;
    if (own.holders === 0) {
        held?.delete(service);
    }
}

export class RedisHandle implements ServiceHandle {
    readonly type = 'redis';
    serviceName: null | string = null;
    readonly defaultPort = 6379;
    readonly defaultImage: string;
    readonly environment: Record<string, string> = {};

    readonly containerOptions = PAIR_INDEXES;

    connectionString = '';
    started = false;

    private dbIndex = 0;

    private pair: null | { service: string; worker: string } = null;

    private sharedConnectionString = '';

    constructor(options: RedisOptions = {}) {
        this.defaultImage = options.image ?? SERVICE_IMAGES.redis;
    }

    buildConnectionString(host: string, port: number): string {
        return `redis://${host}:${port}`;
    }

    createDatabaseAdapter(): DatabasePort | null {
        return null;
    }

    async healthcheck(): Promise<void> {
        if (!this.connectionString) {
            throw invariant('redis() was healthchecked before it had a connection string');
        }

        try {
            const { createClient } = await loadPeer(
                'redis',
                'redis()',
                async () => await import('redis'),
            );
            const client = createClient({ url: this.connectionString });
            await client.connect();
            await client.ping();
            client.destroy();
        } catch (error: any) {
            throw new Error(
                refusal({
                    fix: 'check the container is running and reachable (`docker ps`), and run again',
                    found: `redis() did not answer its healthcheck: ${error.message || error.code || String(error)}`,
                    read: 'docs/18-services.md#service-factories',
                    why: 'A declared service is handed to the chain once it answers its healthcheck.',
                }),
                { cause: error },
            );
        }
    }

    async initialize(): Promise<void> {
        // Redis doesn't need initialization scripts
    }

    async reset(): Promise<void> {
        const { createClient } = await loadPeer(
            'redis',
            'redis()',
            async () => await import('redis'),
        );
        const client = createClient({ url: this.connectionString, database: this.dbIndex });
        await client.connect();
        try {
            await client.flushDb();
        } finally {
            client.destroy();
        }
    }

    isolation(): IsolationStrategy {
        return {
            acquire: async (workerId: string) => {
                this.letGo();
                const worker = Number.parseInt(workerId, 10) || 0;
                const service = this.serviceName ?? this.type;
                const slot = takeSlot(workerId, service);
                if (slot >= SERVICES_PER_WORKER || worker > WORKERS) {
                    freeSlot(workerId, service);
                    throw new Error(
                        refusal({
                            fix:
                                slot >= SERVICES_PER_WORKER
                                    ? `declare fewer redis services: a worker holds ${SERVICES_PER_WORKER} at once`
                                    : `run with fewer workers (--maxWorkers): a container serves ${WORKERS}`,
                            found: `redis: worker ${workerId} has no database index for "${service}"`,
                            read: 'docs/18-services.md#per-worker-isolation',
                            why: 'A redis container’s indexes are shared out four per worker, so its workers and their services are counted.',
                        }),
                    );
                }
                this.pair = { service, worker: workerId };
                this.dbIndex = 1 + SERVICES_PER_WORKER * (Math.max(worker, 1) - 1) + slot;
                // The index is in the string the app is handed, or the app would write to index 0 while reset flushes this one.
                this.sharedConnectionString = this.connectionString;
                this.connectionString = `${this.connectionString}/${this.dbIndex}`;
                // The container outlives the file that held this index before.
                await this.reset();
            },

            reset: async () => {
                await this.reset();
            },

            release: async () => {
                try {
                    await this.reset();
                } finally {
                    this.letGo();
                }
            },
        };
    }

    private letGo(): void {
        if (this.pair === null) {
            return;
        }
        freeSlot(this.pair.worker, this.pair.service);
        this.pair = null;
        this.dbIndex = 0;
        this.connectionString = this.sharedConnectionString;
    }
}

/** Create a Redis service handle, reported under its record key. */
export function redis(options: RedisOptions = {}): RedisHandle {
    return new RedisHandle(options);
}
