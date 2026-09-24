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

/** The indexes a container serves: 0 is its own, and every other is one worker's. */
const DATABASES = 256;

/** A container with an index for every worker a run can hold. */
const WORKER_INDEXES: ContainerOptions = {
    command: ['redis-server', '--databases', String(DATABASES)],
};

export class RedisHandle implements ServiceHandle {
    readonly type = 'redis';
    serviceName: null | string = null;
    readonly defaultPort = 6379;
    readonly defaultImage: string;
    readonly environment: Record<string, string> = {};
    readonly containerOptions = WORKER_INDEXES;

    connectionString = '';
    started = false;

    private dbIndex = 0;

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
                const numericId = Number.parseInt(workerId, 10) || 0;
                if (numericId + 1 >= DATABASES) {
                    throw new Error(
                        `redis: worker ${workerId} has no database index — a container serves ${DATABASES - 1} workers; run with fewer (--maxWorkers)`,
                    );
                }
                this.dbIndex = numericId + 1;
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
