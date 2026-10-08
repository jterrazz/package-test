/**
 * A specimen of the job specification over two databases, built from the services the
 * runner started: a job copying rows from one to the other, one crashing after
 * a write, one reaching out to an HTTP API, and one stamping the instant it ran.
 */
import type { Job } from '@jterrazz/test';

/** What a job of this specimen reads of a database the runner started. */
type Database = { connectionString: string };

async function insertSyncedEvents(analyticsUrl: string, dbUrl: string): Promise<void> {
    const { Client } = await import('pg');

    const source = new Client({ connectionString: dbUrl });
    await source.connect();
    const users = await source.query('SELECT name FROM "users" ORDER BY id');
    await source.end();

    const sink = new Client({ connectionString: analyticsUrl });
    await sink.connect();
    try {
        for (const row of users.rows) {
            await sink.query('INSERT INTO "events" (type, payload) VALUES ($1, $2)', [
                'user_synced',
                JSON.stringify({ name: row.name }),
            ]);
        }
    } finally {
        await sink.end();
    }
}

async function insertOneEvent(analyticsUrl: string, type: string): Promise<void> {
    const { Client } = await import('pg');
    const sink = new Client({ connectionString: analyticsUrl });
    await sink.connect();
    try {
        await sink.query('INSERT INTO "events" (type, payload) VALUES ($1, $2)', [type, '{}']);
    } finally {
        await sink.end();
    }
}

// A job that reaches OUT to an HTTP API and stores what it learns — the vehicle
// for the intercept (`network-strict-after-first-stub`) specs: its outgoing request is what `.intercept()` mocks.
async function enrichFromApi(analyticsUrl: string): Promise<void> {
    const response = await fetch('https://enrich.example.test/label');
    const data = (await response.json()) as { label: string };
    await insertOneEvent(analyticsUrl, data.label);
}

/** The jobs, in the factory form of the `jobs` option. */
export function databaseJobs({
    analyticsDb,
    db,
}: {
    analyticsDb: Database;
    db: Database;
}): Job[] {
    return [
        {
            execute: async () => {
                await insertSyncedEvents(analyticsDb.connectionString, db.connectionString);
            },
            name: 'sync-events',
        },
        {
            execute: async () => {
                // Write one row, then crash — specs assert both the rejection
                // and the pre-crash database state.
                await insertOneEvent(analyticsDb.connectionString, 'pre_crash');
                throw new Error('crash-after-insert: boom');
            },
            name: 'crash-after-insert',
        },
        {
            execute: async () => {
                await enrichFromApi(analyticsDb.connectionString);
            },
            name: 'enrich-from-api',
        },
        {
            execute: async () => {
                // The instant the job ran, as the job reads it: what `.clock()` pins.
                await insertOneEvent(analyticsDb.connectionString, new Date().toISOString());
            },
            name: 'stamp-now',
        },
    ];
}
