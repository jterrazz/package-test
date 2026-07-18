/**
 * Shared jobs specification — `specification.jobs()` has no HTTP server and
 * no mode: jobs run in-process by definition (CONVENTIONS A5/A8).
 */
import { afterAll } from 'vitest';

import { type JobHandle, postgres, specification } from '../../src/index.js';

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
// For the intercept (D7) specs: its outgoing request is what `.intercept()` mocks.
async function enrichFromApi(analyticsUrl: string): Promise<void> {
    const response = await fetch('https://enrich.example.test/label');
    const data = (await response.json()) as { label: string };
    await insertOneEvent(analyticsUrl, data.label);
}

// The `analyticsDb` key auto-binds to the `analytics-db` compose service via
// Kebab-case derivation — no composeService needed (CONVENTIONS A6).
const analyticsHandle = postgres();

export const { cleanup, jobs } = await specification.jobs({
    jobs: ({ analyticsDb, db }): JobHandle[] => [
        {
            execute: () => insertSyncedEvents(analyticsDb.connectionString, db.connectionString),
            name: 'sync-events',
        },
        {
            execute: async () => {
                // Write one row, then crash — specs assert both the rejection
                // And the pre-crash database state.
                await insertOneEvent(analyticsDb.connectionString, 'pre_crash');
                throw new Error('crash-after-insert: boom');
            },
            name: 'crash-after-insert',
        },
        {
            execute: () => enrichFromApi(analyticsDb.connectionString),
            name: 'enrich-from-api',
        },
    ],
    root: '../fixtures/app',
    services: {
        analyticsDb: analyticsHandle,
        db: postgres(),
    },
});

/** Connection string of the analytics database — read lazily (set after start). */
export const analyticsUrl = (): string => analyticsHandle.connectionString;

afterAll(cleanup);
