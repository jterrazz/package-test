import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { ROUTES_DIR, shardLedgersDir, writeLedger } from './ledger.js';
import { judgeSplit, NO_SHARD_LEDGERS } from './route-split.js';
import type { Route } from './routes.js';

/** A green merge, judged. */
const GREEN = { failed: 0, update: false };

/**
 * A project root whose split run's shards each reached the routes listed, the
 * three of `/users` declared by every shard, beside a whole run's ledger that
 * reached `DELETE /users/:id`.
 */
function splitRun(...shards: Route[][]): string {
    const root = mkdtempSync(join(tmpdir(), 'route-split-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    const declared = [
        { method: 'GET', path: '/users' },
        { method: 'GET', path: '/users/:id' },
        { method: 'DELETE', path: '/users/:id' },
    ];
    for (const [index, reached] of shards.entries()) {
        const shard = { count: shards.length, index: index + 1 };
        writeLedger(join(root, shardLedgersDir(shard)), { declared, reached });
    }
    writeLedger(join(root, ROUTES_DIR), {
        declared,
        reached: [{ method: 'DELETE', path: '/users/7' }],
    });
    return root;
}

describe('judgeSplit() — the route ratchet of a split run, judged at its merge', () => {
    test("reads every shard's ledgers as one run's", async () => {
        // Given - two shards reaching the three routes between them
        const root = splitRun(
            [{ method: 'GET', path: '/users' }],
            [
                { method: 'GET', path: '/users/7' },
                { method: 'DELETE', path: '/users/7' },
            ],
        );

        // Then - every route reached, over the two shards together
        await expect(judgeSplit(root, GREEN)).resolves.toStrictEqual({
            line: 'api routes: all 3 declared routes reached',
        });
    });

    test('reads none of the ledgers a whole run left', async () => {
        // Given - two shards reaching two routes of three, the whole run's ledger reaching the third
        const root = splitRun(
            [{ method: 'GET', path: '/users' }],
            [{ method: 'GET', path: '/users/7' }],
        );

        // Then - the third is unreached, the whole run's ledger not read
        await expect(judgeSplit(root, GREEN)).resolves.toStrictEqual({
            failure:
                'api routes: 1 declared route(s) no test reached, the ratchet holds 0 — send each from a spec, or record them with TEST_UPDATE=1:\n  DELETE /users/:id',
        });
    });

    test('holds the split to the ratchet a whole run is held to', async () => {
        // Given - the one shard of a split, reaching one route of three
        const root = splitRun([{ method: 'GET', path: '/users' }]);

        // Then - the two unreached routes fail the merge, named
        await expect(judgeSplit(root, GREEN)).resolves.toStrictEqual({
            failure:
                'api routes: 2 declared route(s) no test reached, the ratchet holds 0 — send each from a spec, or record them with TEST_UPDATE=1:\n  GET /users/:id\n  DELETE /users/:id',
        });
    });

    test("fails a merge that finds no shard's ledgers, rather than passing it unjudged", async () => {
        // Given - a split whose shard folders a whole run emptied, its own ledger left beside them
        const root = splitRun();

        // Then - the merge names what it lacks and the way to get it
        await expect(judgeSplit(root, GREEN)).resolves.toStrictEqual({
            failure: NO_SHARD_LEDGERS,
        });
    });
});
