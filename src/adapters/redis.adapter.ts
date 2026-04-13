import type { DatabasePort } from '../ports/database.port.js';
import type { IsolationStrategy } from '../ports/isolation.port.js';
import type { ServiceHandle } from '../ports/service.port.js';

export interface RedisOptions {
    /** Map to a service in docker-compose.test.yaml. */
    compose?: string;
    /** Override image. */
    image?: string;
}

export class RedisHandle implements ServiceHandle {
    readonly type = 'redis';
    readonly composeName: null | string;
    readonly defaultPort = 6379;
    readonly defaultImage: string;
    readonly environment: Record<string, string> = {};

    connectionString = '';
    started = false;

    private dbIndex = 0;

    constructor(options: RedisOptions = {}) {
        this.composeName = options.compose ?? null;
        this.defaultImage = options.image ?? 'redis:7';
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
            const { createClient } = await import('redis');
            const client = createClient({ url: this.connectionString });
            await client.connect();
            await client.ping();
            await client.disconnect();
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
        const { createClient } = await import('redis');
        const client = createClient({ url: this.connectionString, database: this.dbIndex });
        await client.connect();
        try {
            await client.flushDb();
        } finally {
            await client.disconnect();
        }
    }

    isolation(): IsolationStrategy {
        return {
            acquire: async (workerId: string) => {
                // Use Redis database index 1-15 for workers (0 is default/shared)
                const numericId = Number.parseInt(workerId, 10) || 0;
                this.dbIndex = (numericId % 15) + 1;
            },

            reset: async () => {
                await this.reset();
            },

            release: async () => {
                await this.reset();
                this.dbIndex = 0;
            },
        };
    }
}

/**
 * Create a Redis service handle.
 *
 * @example
 * const cache = redis({ compose: "cache" });
 * // After start: cache.connectionString is populated
 */
export function redis(options: RedisOptions = {}): RedisHandle {
    return new RedisHandle(options);
}
