import type { createClient } from 'redis';

import { invariant, refusal } from '../../chain/refusals/refusal.js';
import type { ContainerOptions } from '../containers/container.port.js';
import { SERVICE_IMAGES } from '../containers/service-images.js';
import type { DatabasePort } from '../database.port.js';
import { driverReason } from '../driver-reason.js';
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

function slotsOf(worker: string): Map<string, Held> {
    const held = slots.get(worker) ?? new Map<string, Held>();
    slots.set(worker, held);
    return held;
}

/** The slot of a service in its worker, shared by every handle of that service; the callback gives this handle's hold back. */
function takeSlot(held: Map<string, Held>, service: string): { free: () => void; slot: number } {
    const own = held.get(service);
    const pair = own ?? { holders: 0, slot: lowestFree(held) };
    pair.holders += 1;
    held.set(service, pair);
    return {
        free: () => {
            pair.holders -= 1;
            if (pair.holders === 0) {
                held.delete(service);
            }
        },
        slot: pair.slot,
    };
}

function lowestFree(held: Map<string, Held>): number {
    const taken = new Set([...held.values()].map((pair) => pair.slot));
    let slot = 0;
    while (taken.has(slot)) {
        slot += 1;
    }
    return slot;
}

// Stryker disable StringLiteral: outside: the driver is installed here; the refusal of a missing peer is peer.ts's, tested there
async function redisDriver(): Promise<{ createClient: typeof createClient }> {
    return await loadPeer('redis', 'redis()', async () => await import('redis'));
}
// Stryker restore StringLiteral

export class RedisHandle implements ServiceHandle {
    readonly type = 'redis';
    serviceName: null | string = null;
    readonly defaultPort = 6379;
    readonly defaultImage: string;
    readonly environment: Record<string, string> = {};

    readonly containerOptions = PAIR_INDEXES;

    connectionString = '';

    private dbIndex = 0;

    /** What this handle holds: its slot's release, and the container's own string it extended. */
    private pair: null | { free: () => void; shared: string } = null;

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
            const { createClient } = await redisDriver();
            const client = createClient({ url: this.connectionString });
            await client.connect();
            await client.ping();
            client.destroy();
        } catch (error) {
            throw new Error(
                refusal({
                    fix: 'check the container is running and reachable (`docker ps`), and run again',
                    found: `redis() did not answer its healthcheck: ${driverReason(error)}`,
                    read: 'docs/reference/services.md#service-factories',
                    why: 'A declared service is handed to the chain once it answers its healthcheck.',
                }),
                { cause: error },
            );
        }
    }

    async initialize(): Promise<void> {
        // invariant: Redis doesn't need initialization scripts
    }

    async reset(): Promise<void> {
        const { createClient } = await redisDriver();
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
                const { free, slot } = takeSlot(slotsOf(workerId), service);
                if (slot >= SERVICES_PER_WORKER || worker > WORKERS) {
                    free();
                    throw new Error(
                        refusal({
                            fix:
                                slot >= SERVICES_PER_WORKER
                                    ? `declare fewer redis services: a worker holds ${SERVICES_PER_WORKER} at once`
                                    : `run with fewer workers (--maxWorkers): a container serves ${WORKERS}`,
                            found: `redis: worker ${workerId} has no database index for "${service}"`,
                            read: 'docs/reference/services.md#per-worker-isolation',
                            why: 'A redis container’s indexes are shared out four per worker, so its workers and their services are counted.',
                        }),
                    );
                }
                this.pair = { free, shared: this.connectionString };
                this.dbIndex = 1 + SERVICES_PER_WORKER * (Math.max(worker, 1) - 1) + slot;
                // hazard: the index is in the string the app is handed, or the app would write to index 0 while reset flushes this one.
                this.connectionString = `${this.connectionString}/${this.dbIndex}`;
                // invariant: the container outlives the file that held this index before.
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
        this.pair.free();
        this.connectionString = this.pair.shared;
        this.pair = null;
        this.dbIndex = 0;
    }
}

/** Create a Redis service handle, reported under its record key. */
export function redis(options: RedisOptions = {}): RedisHandle {
    return new RedisHandle(options);
}
