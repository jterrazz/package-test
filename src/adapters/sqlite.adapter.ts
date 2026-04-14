import Database from 'better-sqlite3';
import { copyFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { DatabasePort } from '../ports/database.port.js';
import type { IsolationStrategy } from '../ports/isolation.port.js';
import type { ServiceHandle } from '../ports/service.port.js';

export interface SqliteOptions {
    /**
     * Path to a SQL file used to initialize the database schema.
     * Mutually exclusive with `prismaSchema`.
     */
    init?: string;
    /**
     * Path to a Prisma schema directory or file.
     * The adapter runs `prisma db push` to create the template.
     * Mutually exclusive with `init`.
     */
    prismaSchema?: string;
}

export class SqliteHandle implements DatabasePort, ServiceHandle {
    readonly type = 'sqlite';
    readonly composeName = null;
    readonly defaultPort = 0;
    readonly defaultImage = '';
    readonly environment: Record<string, string> = {};

    connectionString = '';
    started = false;

    private db: Database.Database | null = null;
    private templatePath = '';
    private workerDbPath = '';
    private initSql: null | string;
    private prismaSchema: null | string;

    constructor(options: SqliteOptions = {}) {
        this.initSql = options.init ?? null;
        this.prismaSchema = options.prismaSchema ?? null;
    }

    buildConnectionString(): string {
        return `file:${this.workerDbPath || this.templatePath}`;
    }

    createDatabaseAdapter(): DatabasePort {
        return this;
    }

    async healthcheck(): Promise<void> {
        // SQLite is always ready — it's a file
    }

    async initialize(): Promise<void> {
        // Each test run gets a fresh template; workers share it via lock
        this.templatePath = resolve(tmpdir(), 'jterrazz-test-sqlite-template.sqlite');
        const lockPath = `${this.templatePath}.lock`;

        if (existsSync(lockPath)) {
            // Another worker is creating it — wait for it
            const start = Date.now();
            while (existsSync(lockPath) && Date.now() - start < 30_000) {
                await new Promise((r) => setTimeout(r, 100));
            }
        }

        if (existsSync(this.templatePath)) {
            this.connectionString = `file:${this.templatePath}`;
            this.started = true;
            return;
        }

        // Acquire lock
        const { writeFileSync } = await import('node:fs');
        writeFileSync(lockPath, process.pid.toString());

        if (this.prismaSchema) {
            // Use Prisma to create schema
            const { execSync } = await import('node:child_process');
            execSync('npx prisma db push --force-reset', {
                env: {
                    ...process.env,
                    DATABASE_URL: `file:${this.templatePath}`,
                    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
                },
                stdio: 'pipe',
            });

            // Checkpoint WAL so the template is a single file (safe to copy)
            const tmpDb = new Database(this.templatePath);
            tmpDb.pragma('wal_checkpoint(TRUNCATE)');
            tmpDb.close();
        } else if (this.initSql) {
            // Use raw SQL to create schema
            const sql = readFileSync(this.initSql, 'utf8');
            const templateDb = new Database(this.templatePath);
            templateDb.exec(sql);
            templateDb.close();
        } else {
            // Empty database — consumer will seed
            const templateDb = new Database(this.templatePath);
            templateDb.close();
        }

        // Release lock
        try {
            unlinkSync(lockPath);
        } catch {
            /* Ignore */
        }

        this.connectionString = `file:${this.templatePath}`;
        this.started = true;
    }

    private getDb(): Database.Database {
        const dbPath = this.workerDbPath || this.templatePath;
        if (!this.db) {
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');
        }
        return this.db;
    }

    private closeDb(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    async seed(sql: string): Promise<void> {
        this.getDb().exec(sql);
    }

    async query(table: string, columns: string[]): Promise<unknown[][]> {
        const columnList = columns.join(', ');
        const rows = this.getDb()
            .prepare(`SELECT ${columnList} FROM "${table}" ORDER BY 1`)
            .all() as Record<string, unknown>[];
        return rows.map((row) => columns.map((col) => row[col]));
    }

    async reset(): Promise<void> {
        const db = this.getDb();
        const tables = db
            .prepare(
                `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name != 'sqlite_sequence'`,
            )
            .all() as { name: string }[];
        for (const { name } of tables) {
            db.exec(`DELETE FROM "${name}"`);
        }
    }

    isolation(): IsolationStrategy {
        return {
            acquire: async (workerId: string) => {
                this.closeDb();
                this.workerDbPath = resolve(
                    tmpdir(),
                    `test-worker-${workerId}-${Date.now()}.sqlite`,
                );
                copyFileSync(this.templatePath, this.workerDbPath);
                this.connectionString = `file:${this.workerDbPath}`;
            },

            reset: async () => {
                await this.reset();
            },

            release: async () => {
                this.closeDb();
                if (this.workerDbPath && existsSync(this.workerDbPath)) {
                    unlinkSync(this.workerDbPath);
                }
                this.workerDbPath = '';
                this.connectionString = `file:${this.templatePath}`;
            },
        };
    }
}

/**
 * Create a SQLite service handle. Uses file-copy isolation for parallel tests.
 *
 * @example
 *   // With Prisma schema
 *   const db = sqlite({ prismaSchema: './prisma/schema' });
 *
 *   // With raw SQL init
 *   const db = sqlite({ init: './schema.sql' });
 *
 *   // Empty database
 *   const db = sqlite();
 */
export function sqlite(options: SqliteOptions = {}): SqliteHandle {
    return new SqliteHandle(options);
}
