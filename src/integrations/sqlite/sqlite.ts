import Database from 'better-sqlite3';
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

import { SQLITE_TEMPLATE_DIR } from '../../core/artifacts/artifacts.js';
import type { DatabasePort } from '../../core/ports/database.port.js';
import type { IsolationStrategy } from '../../core/ports/isolation.port.js';
import type { ServiceHandle } from '../../core/ports/service.port.js';
import { discoverRoot } from '../../core/specification/shared/resolve.js';

// The first 16 bytes of every well-formed SQLite database file (see the
// SQLite file format spec). A crashed earlier run can leave a stale/partial
// Template behind (e.g. 0 bytes) — this is the cheap, dependency-free check
// Used to tell "real template" from "leftover from a crash".
const SQLITE_FILE_HEADER = Buffer.from('SQLite format 3\0');

/**
 * Whether `path` looks like a usable SQLite database file: it exists, is at
 * least as long as the format header, and begins with the SQLite magic
 * bytes. Does not validate anything beyond the header — good enough to
 * reject a 0-byte or truncated leftover without opening the file.
 */
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

/** The invocation used when no `prismaSchema` is declared — Prisma discovers its own schema. */
const PRISMA_PUSH = 'npx prisma db push --force-reset';

/**
 * The `prisma db push` command line for a `prismaSchema` option.
 *
 * The declared path is resolved against `process.cwd()` and handed to the CLI
 * as `--schema`. Without the flag Prisma falls back to its own discovery
 * (`prisma.config.ts` / `package.json#prisma` at the cwd), which silently
 * ignores the option: a repo whose config does not sit at the cwd then fails
 * with "Could not find Prisma Schema that is required for this command" — but
 * only on a machine without a cached template, so the divergence hides until CI.
 *
 * `null` (no option) keeps the bare invocation, discovery and all.
 */
export function prismaPushCommand(prismaSchema: null | string): string {
    if (!prismaSchema) {
        return PRISMA_PUSH;
    }
    return `${PRISMA_PUSH} --schema ${JSON.stringify(resolve(prismaSchema))}`;
}

export interface SqliteOptions {
    /**
     * Path to a SQL file used to initialize the database schema.
     * Mutually exclusive with `prismaSchema`.
     */
    init?: string;
    /**
     * Path to a Prisma schema directory or file, resolved against the current
     * working directory. The adapter runs `prisma db push --schema <path>` to
     * create the template, so the schema needs no Prisma config at the cwd.
     * Mutually exclusive with `init`.
     */
    prismaSchema?: string;
}

/** Every template file this package writes carries that prefix, then its key. */
const TEMPLATE_PREFIX = 'template';

/**
 * How long a waiter tolerates a lock nobody is touching before deciding its
 * holder died mid-build and taking over. A cold `prisma db push` is the slowest
 * build there is and finishes far inside this; a crashed holder would otherwise
 * wedge the suite forever.
 */
const LOCK_STALE_MS = 120_000;

/** How often a waiter re-checks the lock. */
const LOCK_POLL_MS = 50;

/**
 * The schema source as bytes: a file's content, or every file under a
 * directory in a stable order (a Prisma `schema/` folder is a directory). Each
 * entry carries its own path, so moving a schema changes the fingerprint.
 * Anything unreadable degrades to a marker rather than throwing — the path is
 * already in the key, so two projects still never collide.
 */
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

/**
 * The name of the template database for a set of options — `<prefix>-<sha8>`,
 * the digest taken over the schema KIND, its resolved path and its content.
 *
 * The key survives the move out of the OS tmpdir. Within one project it is what
 * makes reuse mean "the same schema": editing a schema builds a new template
 * instead of inheriting the old one — the stale file is header-valid, so the
 * validity check would accept it and the tables would never be rebuilt. It also
 * keeps two checkouts of the SAME project apart when a schema differs between
 * them, on top of the separation the per-project folder already gives.
 */
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

/**
 * The directory a project caches its schema templates in —
 * `<root>/.artifacts/vitest/sqlite/`, created on demand.
 *
 * A project, not a machine. The template used to live in the OS tmpdir, where
 * two checkouts of the same repository shared one file: whichever ran first
 * built it, the other silently inherited that schema, and a branch that changed
 * the schema poisoned the branch beside it. A path under the project root
 * cannot be reached from another checkout at all.
 */
export function sqliteTemplateDir(root: string): string {
    const dir = resolve(root, SQLITE_TEMPLATE_DIR);
    mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * Take the build lock, or report that someone else holds it.
 *
 * `wx` is the whole point: the file is created and claimed in ONE syscall, so
 * two workers cannot both come out of it believing they won. The former
 * check-then-write pair could, and both then ran `prisma db push` against the
 * same file — the `database is locked` failure a consumer keeps
 * `fileParallelism: false` for.
 *
 * @internal Exported for unit tests.
 */
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

/** Drop the build lock. A lock already gone is not an error — the goal is met. */
export function releaseTemplateLock(lockPath: string): void {
    try {
        unlinkSync(lockPath);
    } catch {
        /* Ignore — already released */
    }
}

/**
 * Whether a lock has gone untouched long enough that its holder must be dead.
 * A lock that no longer exists is not stale — the waiter simply retries.
 *
 * @internal Exported for unit tests.
 */
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
    composeName: null | string = null;
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

    /**
     * Make the schema template available, building it if this worker is the one
     * that gets to.
     *
     * The template is cached under the PROJECT's `.artifacts/vitest/sqlite/`,
     * keyed by schema. `root` is the root the specification resolved (A9); a
     * handle initialised outside an orchestrator — a unit test holding one
     * directly — falls back to the same walk from the cwd.
     *
     * One worker builds, the others WAIT: the lock is taken with an exclusive
     * create, so exactly one wins, and a loser polls until the winner is done
     * rather than proceeding into a second concurrent `prisma db push` on the
     * same file (which is what `database is locked` was).
     */
    async initialize(_composeDir?: string, root?: string): Promise<void> {
        const projectRoot = root ?? discoverRoot(process.cwd());
        this.templatePath = resolve(
            sqliteTemplateDir(projectRoot),
            sqliteTemplateName(this.options),
        );
        const lockPath = `${this.templatePath}.lock`;

        for (;;) {
            // A valid template is the answer, whoever built it. An invalid one
            // (a 0-byte leftover from a crashed run) reads as absent, so the
            // Build below replaces it instead of poisoning every later run with
            // "no such table".
            if (isValidSqliteTemplate(this.templatePath)) {
                break;
            }

            if (!acquireTemplateLock(lockPath)) {
                if (isStaleTemplateLock(lockPath)) {
                    releaseTemplateLock(lockPath);
                } else {
                    await new Promise((wake) => setTimeout(wake, LOCK_POLL_MS));
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

    /**
     * Build the template on a private path, then rename it into place.
     *
     * The rename is what makes a half-built template unobservable: it is atomic
     * within a filesystem, so a reader sees either the previous template or the
     * finished one. Building in place could not promise that — `prisma db push`
     * writes the SQLite header long before the tables exist, and a reader that
     * arrived in between accepted a valid-looking file with nothing in it.
     */
    private async buildTemplate(): Promise<void> {
        const buildPath = `${this.templatePath}.${process.pid}.building`;
        removeDatabaseFiles(buildPath);

        try {
            if (this.prismaSchema) {
                const { execSync } = await import('node:child_process');
                execSync(prismaPushCommand(this.prismaSchema), {
                    env: {
                        ...process.env,
                        DATABASE_URL: `file:${buildPath}`,
                        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
                    },
                    stdio: 'pipe',
                });

                // Checkpoint WAL so the template is a single file (safe to copy)
                const tmpDb = new Database(buildPath);
                tmpDb.pragma('wal_checkpoint(TRUNCATE)');
                tmpDb.close();
            } else if (this.initSql) {
                // Use raw SQL to create schema
                const sql = readFileSync(this.initSql, 'utf8');
                const templateDb = new Database(buildPath);
                templateDb.exec(sql);
                templateDb.close();
            } else {
                // Empty database — consumer will seed
                const templateDb = new Database(buildPath);
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
                // Per-RUN scratch, deleted on release — it stays in the OS temp
                // Dir on purpose: it is not something a project produces. The
                // Pid joins the name because a worker id is only unique inside
                // One vitest run, and two runs share this directory.
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
