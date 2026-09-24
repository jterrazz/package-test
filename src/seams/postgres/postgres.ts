import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Client } from 'pg';

import { SERVICE_IMAGES } from '../../model/chain/service-images.js';
import type { ContainerOptions } from '../../model/ports/container.port.js';
import type { DatabasePort } from '../../model/ports/database.port.js';
import type { IsolationStrategy } from '../../model/ports/isolation.port.js';
import type { ServiceHandle } from '../../model/ports/service.port.js';
import {
    buildTemplate,
    clientConstructor,
    cloneName,
    endQuietly,
    withClient,
    withDatabase,
} from './template.js';

export type PostgresOptions = {
    /** Override image. */
    image?: string;
    /** Override environment variables. */
    env?: Record<string, string>;
};

/**
 * A test database holds nothing worth a crash: its data lives on a memory
 * disk, and postgres skips every write that only exists to survive one.
 */
const DISPOSABLE: ContainerOptions = {
    command: [
        'postgres',
        '-c',
        'fsync=off',
        '-c',
        'synchronous_commit=off',
        '-c',
        'full_page_writes=off',
    ],
    tmpfs: { '/var/lib/postgresql/data': 'rw' },
};

export class PostgresHandle implements DatabasePort, ServiceHandle {
    readonly type = 'postgres';
    serviceName: null | string = null;
    readonly defaultPort = 5432;
    readonly defaultImage: string;
    readonly environment: Record<string, string>;
    readonly containerOptions = DISPOSABLE;

    connectionString = '';
    started = false;

    private client: Client | null = null;
    /** The container's own string, which a worker's clone replaces and is restored from. */
    private containerConnectionString = '';
    /** The template the init script built — `null` for a service with no script. */
    private template: null | string = null;
    /** The worker's clone, while one is acquired. */
    private database: null | string = null;

    constructor(options: PostgresOptions = {}) {
        this.defaultImage = options.image ?? SERVICE_IMAGES.postgres;
        this.environment = {
            POSTGRES_DB: 'test',
            POSTGRES_PASSWORD: 'test',
            POSTGRES_USER: 'test',
            ...options.env,
        };
    }

    buildConnectionString(host: string, port: number): string {
        const user = this.environment.POSTGRES_USER ?? 'test';
        const password = this.environment.POSTGRES_PASSWORD ?? 'test';
        const db = this.environment.POSTGRES_DB ?? 'test';
        return `postgresql://${user}:${password}@${host}:${port}/${db}`;
    }

    createDatabaseAdapter(): DatabasePort {
        return this;
    }

    async healthcheck(): Promise<void> {
        if (!this.connectionString) {
            throw new Error('postgres: cannot healthcheck — no connection string');
        }

        // Healthcheck uses a throwaway client (connection might not be established yet)
        try {
            const PgClient = await clientConstructor();
            const client = new PgClient({ connectionString: this.connectionString });
            await client.connect();
            await client.query('SELECT 1');
            await client.end();
        } catch (error: any) {
            throw new Error(
                `postgres healthcheck failed: ${error.message || error.code || String(error)}`,
                { cause: error },
            );
        }
    }

    async initialize(dockerDir: string): Promise<void> {
        if (!this.serviceName) {
            return;
        }

        // Its own name first, then the type's — one database in a project needs
        // No folder of its own, and several each get one named after their key.
        const initPaths = [
            resolve(dockerDir, `${this.serviceName}/init.sql`),
            resolve(dockerDir, 'postgres/init.sql'),
        ];

        for (const initPath of initPaths) {
            if (existsSync(initPath)) {
                this.template = await buildTemplate(
                    this.connectionString,
                    readFileSync(initPath, 'utf8'),
                    initPath,
                );
                return;
            }
        }
    }

    private async getClient(): Promise<Client> {
        if (this.client) {
            return this.client;
        }
        const PgClient = await clientConstructor();
        const client = new PgClient({ connectionString: this.connectionString });
        client.on('error', () => {
            // Connection dropped (container stopped) — reset so next call reconnects
            this.client = null;
        });
        await client.connect();
        this.client = client;
        return client;
    }

    async seed(sql: string): Promise<void> {
        const client = await this.getClient();
        await client.query(sql);
    }

    async reset(): Promise<void> {
        const client = await this.getClient();
        const result = await client.query<{ tablename: string }>(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename NOT LIKE '_prisma%'
        `);
        const tables = result.rows.map(({ tablename }) => `"public"."${tablename}"`);
        if (tables.length > 0) {
            await client.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
        }
    }

    async query(table: string, columns: string[]): Promise<unknown[][]> {
        const client = await this.getClient();
        const columnList = columns.join(', ');
        const result = await client.query(
            `SELECT ${columnList} FROM "public"."${table}" ORDER BY 1`,
        );
        return result.rows.map((row: Record<string, unknown>) => columns.map((col) => row[col]));
    }

    async columns(table: string): Promise<string[]> {
        const client = await this.getClient();
        const result = await client.query<{ column_name: string }>(
            'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position',
            ['public', table],
        );
        return result.rows.map((row) => row.column_name);
    }

    isolation(): IsolationStrategy {
        return {
            acquire: async (workerId: string) => {
                const database = cloneName(
                    this.environment.POSTGRES_DB ?? 'test',
                    this.serviceName ?? this.type,
                    workerId,
                );
                await withClient(this.connectionString, async (admin) => {
                    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
                    await admin.query(
                        `CREATE DATABASE "${database}" TEMPLATE "${this.template ?? 'template1'}"`,
                    );
                });
                await this.closeClient();
                this.containerConnectionString = this.connectionString;
                this.connectionString = withDatabase(this.connectionString, database);
                this.database = database;
            },

            reset: async () => {
                await this.reset();
            },

            release: async () => {
                await this.closeClient();
                const { database } = this;
                if (database === null) {
                    return;
                }
                this.connectionString = this.containerConnectionString;
                this.database = null;
                await withClient(this.connectionString, async (admin) => {
                    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
                });
            },
        };
    }

    private async closeClient(): Promise<void> {
        const { client } = this;
        this.client = null;
        await endQuietly(client);
    }
}

/**
 * Create a PostgreSQL service handle.
 *
 * @example
 * // The record key is the name: it is the spec's `database` vocabulary, and
 * // Kebab-cased it is the folder the init script is read from.
 * //   { db: postgres() }          → docker/db/init.sql, then docker/postgres/init.sql
 * //   { analyticsDb: postgres() } → docker/analytics-db/init.sql
 * const events = postgres();
 * // After start: events.connectionString is populated
 */
export function postgres(options: PostgresOptions = {}): PostgresHandle {
    return new PostgresHandle(options);
}
