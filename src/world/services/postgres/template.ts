import { createHash } from 'node:crypto';
import type { Client } from 'pg';

import { loadPeer } from '../peer.js';

/**
 * How a postgres handle isolates a worker: a template database its init
 * script builds once per container, and a database per worker cloned from it.
 */

/**
 * `pg`'s client constructor, loaded on the first connection.
 *
 * The driver is an OPTIONAL peer: a repository that specifies a CLI never
 * reaches this line, and never pays for the import.
 */
export async function clientConstructor(): Promise<typeof Client> {
    return await loadPeer('pg', 'postgres()', async () => {
        const pg = await import('pg');
        return pg.Client;
    });
}

/** End a client whose connection may already be gone — a dead one has nothing left to close. */
export async function endQuietly(client: Client | null): Promise<void> {
    try {
        await client?.end();
    } catch {
        /* Already closed */
    }
}

/** The same server, another database. */
export function withDatabase(connectionString: string, database: string): string {
    const url = new URL(connectionString);
    url.pathname = `/${database}`;
    return url.toString();
}

/**
 * The database a worker's handle is cloned into: the container's database,
 * the service, the worker — unique among the clones one container holds at a
 * time, and the same on every run, so a clone a crashed run left is dropped
 * by the next worker of that name.
 */
export function cloneName(base: string, service: string, workerId: string): string {
    return `${base}_${service}_${workerId}`.toLowerCase().replaceAll(/[^a-z0-9_]/gu, '_');
}

/** Run `work` on a client of its own, closed whatever `work` did. */
export async function withClient<T>(
    connectionString: string,
    work: (client: Client) => Promise<T>,
): Promise<T> {
    const PgClient = await clientConstructor();
    const client = new PgClient({ connectionString });
    client.on('error', () => {
        // A dropped connection fails the query in flight, which is what reports it.
    });
    await client.connect();
    try {
        return await work(client);
    } finally {
        await endQuietly(client);
    }
}

/**
 * The template database an init script builds, once per container.
 *
 * Its name is the script's digest, so every handle whose script reads the same
 * shares it and a changed script builds another. The build holds an advisory
 * lock, so one worker builds while the others wait and then find it; a
 * template is marked `IS_TEMPLATE` only once its script ran whole, and one
 * left unmarked by a crash is dropped and built again. A script that fails
 * leaves no template behind, and its error names the script.
 */
export async function buildTemplate(
    connectionString: string,
    sql: string,
    initPath: string,
): Promise<string> {
    const template = `template_${createHash('sha256').update(sql).digest('hex').slice(0, 16)}`;
    return await withClient(connectionString, async (admin) => {
        await admin.query('SELECT pg_advisory_lock(hashtext($1))', [template]);
        try {
            const existing = await admin.query<{ datistemplate: boolean }>(
                'SELECT datistemplate FROM pg_database WHERE datname = $1',
                [template],
            );
            if (existing.rows[0]?.datistemplate === true) {
                return template;
            }
            await admin.query(`DROP DATABASE IF EXISTS "${template}" WITH (FORCE)`);
            await admin.query(`CREATE DATABASE "${template}"`);
            try {
                await withClient(withDatabase(connectionString, template), async (builder) => {
                    await builder.query(sql);
                });
            } catch (error: any) {
                await admin.query(`DROP DATABASE IF EXISTS "${template}" WITH (FORCE)`);
                throw new Error(`postgres init script failed (${initPath}):\n${error.message}`, {
                    cause: error,
                });
            }
            await admin.query(`ALTER DATABASE "${template}" IS_TEMPLATE true`);
            return template;
        } finally {
            await admin.query('SELECT pg_advisory_unlock(hashtext($1))', [template]);
        }
    });
}
