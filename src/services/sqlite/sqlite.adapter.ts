import type Database from 'better-sqlite3';
import { copyFileSync, existsSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { discoverRoot } from '../../../lint/kit/project/resolve.js';
import { pause } from '../../chain/pause.js';
import { invariant } from '../../chain/refusals/refusal.js';
import type { DatabasePort } from '../database.port.js';
import type { IsolationStrategy } from '../isolation.port.js';
import { loadPeer, requireBuiltPeer } from '../peer.js';
import type { ServiceHandle } from '../service.port.js';
import {
    acquireTemplateLock,
    isStaleTemplateLock,
    isValidSqliteTemplate,
    prismaPushCommand,
    releaseTemplateLock,
    sqliteTemplateDir,
    sqliteTemplateName,
} from './sqlite-template.js';
import type { SqliteOptions } from './sqlite-template.js';

/** An optional peer, a native module to compile. */
let databaseConstructor: null | typeof Database = null;

async function loadDatabase(): Promise<typeof Database> {
    if (databaseConstructor === null) {
        const constructor = await loadPeer('better-sqlite3', 'sqlite()', async () => {
            const betterSqlite3 = await import('better-sqlite3');
            return betterSqlite3.default;
        });
        // outside: installed is not built: npm, pnpm and bun withhold install scripts. Opening one database here lets the refusal name the peer and the command.
        requireBuiltPeer('better-sqlite3', 'sqlite()', () => {
            const Probe = constructor;
            new Probe(':memory:').close();
        });
        databaseConstructor = constructor;
    }
    return databaseConstructor;
}

/** The read accessors run only after `initialize()` opened a database, which keeps them sync. */
function database(): typeof Database {
    if (databaseConstructor === null) {
        throw invariant('sqlite() was read before `initialize()` loaded its driver');
    }
    return databaseConstructor;
}

const LOCK_POLL_MS = 50;

/** Remove a file and the WAL sidecars SQLite may have left beside it. */
function removeDatabaseFiles(path: string): void {
    for (const suffix of ['', '-wal', '-shm']) {
        try {
            unlinkSync(`${path}${suffix}`);
        } catch {
            /* invariant: ignore — nothing to remove */
        }
    }
}

export class SqliteHandle implements DatabasePort, ServiceHandle {
    readonly type = 'sqlite';
    serviceName: null | string = null;
    readonly defaultPort = 0;
    readonly defaultImage = '';
    readonly environment: Record<string, string> = {};

    connectionString = '';
    started = false;

    private db: Database.Database | null = null;
    private templatePath = '';
    private workerDbPath = '';
    private readonly initSql: null | string;
    private readonly prismaSchema: null | string;
    private readonly options: SqliteOptions;

    constructor(options: SqliteOptions = {}) {
        this.options = options;
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
        // invariant: SQLite is always ready — it's a file
    }

    /** One worker builds under an exclusive lock, the others wait: two concurrent `prisma db push` on one file is `database is locked`. */
    async initialize(_dockerDir?: string, root?: string): Promise<void> {
        await loadDatabase();
        const projectRoot = root ?? discoverRoot(process.cwd());
        this.templatePath = resolve(
            sqliteTemplateDir(projectRoot),
            sqliteTemplateName(this.options),
        );
        const lockPath = `${this.templatePath}.lock`;

        for (;;) {
            // invariant: an invalid template (a crash's 0-byte leftover) reads as absent and is rebuilt.
            if (isValidSqliteTemplate(this.templatePath)) {
                break;
            }

            if (!acquireTemplateLock(lockPath)) {
                if (isStaleTemplateLock(lockPath)) {
                    releaseTemplateLock(lockPath);
                } else {
                    await pause(LOCK_POLL_MS);
                }
                continue;
            }

            try {
                await this.buildTemplate();
            } finally {
                releaseTemplateLock(lockPath);
            }
            break;
        }

        this.connectionString = `file:${this.templatePath}`;
        this.started = true;
    }

    /** Built on a private path, then renamed into place: `prisma db push` writes the header long before the tables exist. */
    private async buildTemplate(): Promise<void> {
        const buildPath = `${this.templatePath}.${process.pid}.building`;
        removeDatabaseFiles(buildPath);

        try {
            await this.writeTemplate(buildPath);
            renameSync(buildPath, this.templatePath);
        } finally {
            removeDatabaseFiles(buildPath);
        }
    }

    private async writeTemplate(buildPath: string): Promise<void> {
        if (this.prismaSchema !== null) {
            const { runToCompletion } = await import('../process/serve.js');
            runToCompletion(prismaPushCommand(this.prismaSchema), {
                ...process.env,
                DATABASE_URL: `file:${buildPath}`,
                PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
            });
            // invariant: checkpoint WAL so the template is a single file, safe to copy.
            const tmpDb = new (database())(buildPath);
            tmpDb.pragma('wal_checkpoint(TRUNCATE)');
            tmpDb.close();
            return;
        }
        const templateDb = new (database())(buildPath);
        if (this.initSql !== null) {
            templateDb.exec(readFileSync(this.initSql, 'utf8'));
        }
        templateDb.close();
    }

    private getDb(): Database.Database {
        const dbPath = this.workerDbPath || this.templatePath;
        if (!this.db) {
            this.db = new (database())(dbPath);
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
            .prepare<[], Record<string, unknown>>(`SELECT ${columnList} FROM "${table}" ORDER BY 1`)
            .all();
        return rows.map((row) => columns.map((col) => row[col]));
    }

    async columns(table: string): Promise<string[]> {
        const statement = this.getDb().prepare<[], { name: string }>(
            `PRAGMA table_info("${table}")`,
        );
        const rows = await Promise.resolve(statement.all());
        return rows.map((row) => row.name);
    }

    async reset(): Promise<void> {
        const db = this.getDb();
        const tables = db
            .prepare<[], { name: string }>(
                `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name != 'sqlite_sequence'`,
            )
            .all();
        for (const { name } of tables) {
            db.exec(`DELETE FROM "${name}"`);
        }
        const counted = db
            .prepare(
                `SELECT name FROM sqlite_master WHERE type='table' AND name = 'sqlite_sequence'`,
            )
            .get();
        if (counted !== undefined) {
            db.exec('DELETE FROM sqlite_sequence');
        }
    }

    isolation(): IsolationStrategy {
        return {
            acquire: async (workerId: string) => {
                this.closeDb();
                // invariant: per-run scratch in the OS temp dir; the pid joins the name because a worker id is unique only inside one vitest run.
                this.workerDbPath = resolve(
                    tmpdir(),
                    `test-worker-${workerId}-${process.pid}-${Date.now()}.sqlite`,
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

/** Create a SQLite service handle, isolated per test by file copy. */
export function sqlite(options: SqliteOptions = {}): SqliteHandle {
    return new SqliteHandle(options);
}
