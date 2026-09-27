import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import {
    closeSync,
    copyFileSync,
    existsSync,
    mkdirSync,
    openSync,
    readdirSync,
    readFileSync,
    readSync,
    renameSync,
    statSync,
    unlinkSync,
    writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { SQLITE_TEMPLATE_DIR } from '../../../../lint/engine/project/artifacts.js';
import { discoverRoot } from '../../../../lint/engine/project/resolve.js';
import { pause } from '../../../kernel/pause.js';
import { invariant } from '../../../kernel/refusals/invariant.js';
import type { DatabasePort } from '../database.port.js';
import type { IsolationStrategy } from '../isolation.port.js';
import { loadPeer, requireBuiltPeer } from '../peer.js';
import type { ServiceHandle } from '../service.port.js';

// The SQLite file-format header: a crash can leave a 0-byte or partial template behind.
const SQLITE_FILE_HEADER = Buffer.from('SQLite format 3\0');

/** An optional peer, a native module to compile. */
let databaseConstructor: null | typeof Database = null;

async function loadDatabase(): Promise<typeof Database> {
    if (databaseConstructor === null) {
        const constructor = await loadPeer('better-sqlite3', 'sqlite()', async () => {
            const betterSqlite3 = await import('better-sqlite3');
            return betterSqlite3.default;
        });
        // Installed is not built: npm, pnpm and bun withhold install scripts. Opening one database here lets the refusal name the peer and the command.
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

/** Checks the header only: enough to reject a 0-byte or truncated leftover. */
export function isValidSqliteTemplate(path: string): boolean {
    if (!existsSync(path)) {
        return false;
    }

    let fd: number;
    try {
        fd = openSync(path, 'r');
    } catch {
        return false;
    }

    try {
        const header = Buffer.alloc(SQLITE_FILE_HEADER.length);
        const bytesRead = readSync(fd, header, 0, header.length, 0);
        return bytesRead === SQLITE_FILE_HEADER.length && header.equals(SQLITE_FILE_HEADER);
    } catch {
        return false;
    } finally {
        closeSync(fd);
    }
}

const PRISMA_PUSH = 'npx prisma db push --force-reset';

/** `--schema` is required: without it Prisma's own discovery ignores the option, and only a machine without a cached template fails. */
export function prismaPushCommand(prismaSchema: null | string): string {
    if (!prismaSchema) {
        return PRISMA_PUSH;
    }
    return `${PRISMA_PUSH} --schema ${JSON.stringify(resolve(prismaSchema))}`;
}

export type SqliteOptions = {
    /** Path to a SQL file initializing the schema; exclusive with `prismaSchema`. */
    init?: string;
    /** Path to a Prisma schema, resolved against the cwd and handed to `prisma db push --schema`; exclusive with `init`. */
    prismaSchema?: string;
};

const TEMPLATE_PREFIX = 'template';

/** A crashed holder would wedge the suite; a cold `prisma db push` finishes far inside this. */
const LOCK_STALE_MS = 120_000;

const LOCK_POLL_MS = 50;

/** Each entry carries its path, so moving a schema changes the fingerprint; unreadable degrades to a marker, the path already in the key. */
function schemaBytes(path: string): string {
    try {
        if (statSync(path).isDirectory()) {
            return readdirSync(path)
                .sort()
                .map((entry) => schemaBytes(join(path, entry)))
                .join('\0');
        }
        return `${path}\0${readFileSync(path, 'utf8')}`;
    } catch {
        return `${path}\0<unreadable>`;
    }
}

/** Editing a schema builds a new template: the stale file is header-valid and would never be rebuilt. */
export function sqliteTemplateName(options: SqliteOptions = {}): string {
    let fingerprint: string;
    if (options.prismaSchema) {
        const path = resolve(options.prismaSchema);
        fingerprint = `prisma\0${path}\0${schemaBytes(path)}`;
    } else if (options.init) {
        const path = resolve(options.init);
        fingerprint = `init\0${path}\0${schemaBytes(path)}`;
    } else {
        fingerprint = 'empty';
    }
    const key = createHash('sha256').update(fingerprint).digest('hex').slice(0, 8);
    return `${TEMPLATE_PREFIX}-${key}.sqlite`;
}

/** Per project, never the OS tmpdir: two checkouts sharing one template inherit each other's schema. */
export function sqliteTemplateDir(root: string): string {
    const dir = resolve(root, SQLITE_TEMPLATE_DIR);
    mkdirSync(dir, { recursive: true });
    return dir;
}

/** `wx` creates and claims the file in one syscall: two workers cannot both win and run `prisma db push` on one file. */
export function acquireTemplateLock(lockPath: string): boolean {
    let fd: number;
    try {
        fd = openSync(lockPath, 'wx');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            return false;
        }
        throw error;
    }
    try {
        writeSync(fd, process.pid.toString());
    } finally {
        closeSync(fd);
    }
    return true;
}

export function releaseTemplateLock(lockPath: string): void {
    try {
        unlinkSync(lockPath);
    } catch {
        /* Ignore — already released */
    }
}

/** A lock that no longer exists is not stale: the waiter retries. */
export function isStaleTemplateLock(lockPath: string, now: number = Date.now()): boolean {
    try {
        return now - statSync(lockPath).mtimeMs > LOCK_STALE_MS;
    } catch {
        return false;
    }
}

/** Remove a file and the WAL sidecars SQLite may have left beside it. */
function removeDatabaseFiles(path: string): void {
    for (const suffix of ['', '-wal', '-shm']) {
        try {
            unlinkSync(`${path}${suffix}`);
        } catch {
            /* Ignore — nothing to remove */
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
        // SQLite is always ready — it's a file
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
            // An invalid template (a crash's 0-byte leftover) reads as absent and is rebuilt.
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
            if (this.prismaSchema) {
                const { runToCompletion } = await import('../process/serve.js');
                runToCompletion(prismaPushCommand(this.prismaSchema), {
                    ...process.env,
                    DATABASE_URL: `file:${buildPath}`,
                    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
                });

                // Checkpoint WAL so the template is a single file, safe to copy.
                const tmpDb = new (database())(buildPath);
                tmpDb.pragma('wal_checkpoint(TRUNCATE)');
                tmpDb.close();
            } else if (this.initSql) {
                const sql = readFileSync(this.initSql, 'utf8');
                const templateDb = new (database())(buildPath);
                templateDb.exec(sql);
                templateDb.close();
            } else {
                const templateDb = new (database())(buildPath);
                templateDb.close();
            }

            renameSync(buildPath, this.templatePath);
        } finally {
            removeDatabaseFiles(buildPath);
        }
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
            .prepare(`SELECT ${columnList} FROM "${table}" ORDER BY 1`)
            .all() as Record<string, unknown>[];
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
            .prepare(
                `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name != 'sqlite_sequence'`,
            )
            .all() as { name: string }[];
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
                // Per-run scratch in the OS temp dir; the pid joins the name because a worker id is unique only inside one vitest run.
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
