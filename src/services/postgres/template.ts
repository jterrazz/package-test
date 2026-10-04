import { createHash } from 'node:crypto';
import type { Client } from 'pg';

import { refusal } from '../../chain/refusals/refusal.js';
import { loadPeer } from '../peer.js';

/** An optional peer: a repository that never connects never pays for the import. */
export async function clientConstructor(): Promise<typeof Client> {
    // Stryker disable next-line StringLiteral: the driver is installed here; the refusal of a missing peer is peer.ts's, tested there
    return await loadPeer('pg', 'postgres()', async () => {
        const pg = await import('pg');
        return pg.Client;
    });
}

export async function endQuietly(client: Client | null): Promise<void> {
    try {
        await client?.end();
    } catch {
        /* invariant: already closed */
    }
}

export function withDatabase(connectionString: string, database: string): string {
    const url = new URL(connectionString);
    url.pathname = `/${database}`;
    return url.toString();
}

/** Unique among one container's clones and the same on every run, so a clone a crashed run left is dropped by the next worker of that name. */
export function cloneName(base: string, service: string, workerId: string): string {
    return `${base}_${service}_${workerId}`.toLowerCase().replaceAll(/[^a-z0-9_]/gu, '_');
}

export async function withClient<T>(
    connectionString: string,
    work: (client: Client) => Promise<T>,
): Promise<T> {
    const PgClient = await clientConstructor();
    const client = new PgClient({ connectionString });
    client.on('error', () => {
        // invariant: a dropped connection fails the query in flight, which is what reports it.
    });
    await client.connect();
    try {
        return await work(client);
    } finally {
        await endQuietly(client);
    }
}

/** Named by the script's digest; built under an advisory lock, marked `IS_TEMPLATE` only once the script ran whole, a crash's unmarked one rebuilt. */
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
            } catch (error) {
                await admin.query(`DROP DATABASE IF EXISTS "${template}" WITH (FORCE)`);
                throw new Error(
                    refusal({
                        fix: `correct ${initPath}: the SQL fails as written`,
                        found: `the postgres init script ${initPath} failed: ${error instanceof Error ? error.message : String(error)}`,
                        read: 'docs/reference/services.md#dockerserviceinitsql',
                        why: 'A postgres service’s template database is built by its init script, run whole.',
                    }),
                    { cause: error },
                );
            }
            await admin.query(`ALTER DATABASE "${template}" IS_TEMPLATE true`);
            return template;
        } finally {
            await admin.query('SELECT pg_advisory_unlock(hashtext($1))', [template]);
        }
    });
}
