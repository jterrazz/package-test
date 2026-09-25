import { SERVICE_IMAGES } from '../../model/chain/service-images.js';
import type { ContainerOptions } from '../../model/ports/container.port.js';
import type { DatabasePort } from '../../model/ports/database.port.js';
import type { IsolationStrategy } from '../../model/ports/isolation.port.js';
import type { ServiceHandle } from '../../model/ports/service.port.js';
import { loadPeer } from '../peer.js';

export type RedisOptions = {
    /** Override image. */
    image?: string;
};

/** The indexes a container serves: 0 is its own, and every other is one (worker, service) pair's. */
const DATABASES = 256;

/** The indexes a worker holds, one per redis service of the record it runs. */
const SERVICES_PER_WORKER = 4;

/** How many workers a container serves every index of. */
const WORKERS = Math.floor((DATABASES - 1) / SERVICES_PER_WORKER);

/** A container with an index for every (worker, service) pair a run can hold. */
const PAIR_INDEXES: ContainerOptions = {
    command: ['redis-server', '--databases', String(DATABASES)],
};

/**
 * The service slot each (worker, service) pair holds in this process: one
 * worker id per process, so the pairs of every other worker are theirs.
 */
const slots = new Map<string, Map<string, number>>();

/** The slot a pair holds — the one it already had, or the lowest its worker holds free. */
function takeSlot(worker: string, service: string): number {
    const held = slots.get(worker) ?? new Map<string, number>();
    slots.set(worker, held);
    const own = held.get(service);
    if (own !== undefined) {
        return own;
    }
    const taken = new Set(held.values());
    let slot = 0;
    while (taken.has(slot)) {
        slot += 1;
    }
    held.set(service, slot);
    return slot;
}

function freeSlot(worker: string, service: string): void {
    slots.get(worker)?.delete(service);
}

export class RedisHandle implements ServiceHandle {
    readonly type = 'redis';
    serviceName: null | string = null;
    readonly defaultPort = 6379;
    readonly defaultImage: string;
    readonly environment: Record<string, string> = {};

    /** One container for every redis service: a pair's index is what isolates it. */
    readonly containerOptions = PAIR_INDEXES;

    connectionString = '';
    started = false;

    private dbIndex = 0;

    /** The pair this handle holds an index for, while it holds one. */
    private pair: null | { service: string; worker: string } = null;

    /** The container's own string, which a worker's index is appended to and restored from. */
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
            throw new Error('redis: cannot healthcheck — no connection string');
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
                `redis healthcheck failed: ${error.message || error.code || String(error)}`,
                {
                    cause: error,
                },
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
                const worker = Number.parseInt(workerId, 10) || 0;
                const service = this.serviceName ?? this.type;
                const slot = takeSlot(workerId, service);
                const index = 1 + worker * SERVICES_PER_WORKER + slot;
                if (slot >= SERVICES_PER_WORKER || index >= DATABASES) {
                    freeSlot(workerId, service);
                    throw new Error(
                        slot >= SERVICES_PER_WORKER
                            ? `redis: worker ${workerId} has no database index for "${service}" — a worker holds ${SERVICES_PER_WORKER} redis services at once; declare fewer`
                            : `redis: worker ${workerId} has no database index for "${service}" — a container serves ${WORKERS} workers; run with fewer (--maxWorkers)`,
                    );
                }
                this.pair = { service, worker: workerId };
                this.dbIndex = index;
                // The index is in the string the app is handed, or the app
                // Would write to the shared index 0 while reset flushes this one.
                this.sharedConnectionString = this.connectionString;
                this.connectionString = `${this.connectionString}/${this.dbIndex}`;
                // The container outlives the file that held this index before.
                await this.reset();
            },

            reset: async () => {
                await this.reset();
            },

            release: async () => {
                await this.reset();
                if (this.pair !== null) {
                    freeSlot(this.pair.worker, this.pair.service);
                    this.pair = null;
                }
                this.dbIndex = 0;
                this.connectionString = this.sharedConnectionString;
            },
        };
    }
}

/**
 * Create a Redis service handle.
 *
 * @example
 * // The record key is the name it reports under: { cache: redis() } → "cache".
 * const cache = redis();
 * // After start: cache.connectionString is populated
 */
export function redis(options: RedisOptions = {}): RedisHandle {
    return new RedisHandle(options);
}
