import { createHash } from 'node:crypto';
import {
    closeSync,
    existsSync,
    mkdirSync,
    openSync,
    readdirSync,
    readFileSync,
    readSync,
    statSync,
    unlinkSync,
    writeSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import { SQLITE_TEMPLATE_DIR } from '../../../lint/kit/project/artifacts.js';

// outside: the SQLite file-format header: a crash can leave a 0-byte or partial template behind.
const SQLITE_FILE_HEADER = Buffer.from('SQLite format 3\0');

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
    if (prismaSchema === null) {
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

/** Each entry carries its path, so moving a schema changes the fingerprint; unreadable degrades to a marker, the path already in the key. */
function schemaBytes(path: string): string {
    try {
        if (statSync(path).isDirectory()) {
            return readdirSync(path)
                .toSorted()
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
    const [source, path] =
        options.prismaSchema === undefined
            ? ['init', options.init]
            : ['prisma', options.prismaSchema];
    const fingerprint =
        path === undefined ? 'empty' : `${source}\0${resolve(path)}\0${schemaBytes(resolve(path))}`;
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
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
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
        /* invariant: ignore — already released */
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
