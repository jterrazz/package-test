import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    clearLedgers,
    markPartial,
    measure,
    partialShards,
    readLedgers,
    readShardLedgers,
    shardLedgersDir,
    writeLedger,
} from '../ledger.js';

const GET_USERS = { method: 'GET', path: '/users' };

const POST_USERS = { method: 'POST', path: '/users' };

describe('ledger', () => {
    test('readLedgers — reads every whole ledger a file wrote, and nothing else in the folder', () => {
        // Given - two ledgers written, beside a text file and JSON files that are no ledger
        const scratch = mkdtempSync(join(tmpdir(), 'routes-ledger-'));
        const folder = join(scratch, 'run');
        writeLedger(folder, { declared: [GET_USERS], reached: [GET_USERS] });
        writeLedger(folder, { reached: [POST_USERS] });
        const strays = {
            'declared.json': { declared: 'GET /', reached: [] },
            'notes.txt': 'not json',
            'null.json': null,
            'reached.json': { reached: 'GET /' },
        };
        for (const [name, content] of Object.entries(strays)) {
            writeFileSync(join(folder, name), JSON.stringify(content));
        }

        // Then - the two ledgers, in any order; a folder never written holds none
        expect([
            readLedgers(folder)
                .map((ledger) => JSON.stringify(ledger))
                .toSorted(),
            readLedgers(join(folder, 'missing')),
        ]).toStrictEqual([
            [
                JSON.stringify({ declared: [GET_USERS], reached: [GET_USERS] }),
                JSON.stringify({ reached: [POST_USERS] }),
            ],
            [],
        ]);
    });

    test('shards — each shard writes to a folder of its own, read back together, the partial ones named in order', () => {
        // Given - two shards writing ledgers, the second and a folder that is no shard marked partial, and a file named like a shard
        const routes = mkdtempSync(join(tmpdir(), 'routes-shards-'));
        const first = join(routes, 'shard-1-2');
        const second = join(routes, 'shard-2-2');
        writeLedger(first, { reached: [GET_USERS] });
        writeLedger(second, { reached: [POST_USERS] });
        markPartial(second);
        markPartial(first);
        markPartial(join(routes, 'other'));
        writeLedger(join(routes, 'other'), { reached: [GET_USERS] });
        writeFileSync(join(routes, 'shard-file'), '');

        // Then - the shard folders' names, their ledgers, and nothing from elsewhere
        expect([
            shardLedgersDir({ count: 2, index: 1 }),
            partialShards(routes),
            readShardLedgers(routes)
                .map(({ reached }) => JSON.stringify(reached))
                .toSorted(),
            partialShards(join(routes, 'missing')),
            readShardLedgers(join(routes, 'missing')),
        ]).toStrictEqual([
            '.artifacts/vitest/routes/shard-1-2',
            ['shard-1-2', 'shard-2-2'],
            [JSON.stringify([GET_USERS]), JSON.stringify([POST_USERS])],
            [],
            [],
        ]);
    });

    test('measure — the reached requests of every ledger, and the declared routes only when every ledger declared them', () => {
        // Given - ledgers that all declare, and ledgers one of which declares nothing
        const declaring = [
            { declared: [GET_USERS], reached: [GET_USERS] },
            { declared: [POST_USERS], reached: [] },
        ];

        // Then - the union, or no declared table at all
        expect([
            measure(declaring),
            measure([...declaring, { reached: [POST_USERS] }]),
        ]).toStrictEqual([
            { declared: [GET_USERS, POST_USERS], reached: [GET_USERS] },
            { declared: undefined, reached: [GET_USERS, POST_USERS] },
        ]);
    });

    test('clearLedgers — removes a folder and all it holds, and a folder that is not there is no error', () => {
        // Given - a folder holding a ledger in a subfolder
        const folder = mkdtempSync(join(tmpdir(), 'routes-clear-'));
        mkdirSync(join(folder, 'shard-1-1'));
        writeLedger(join(folder, 'shard-1-1'), { reached: [] });

        // When - it is cleared, twice
        clearLedgers(folder);
        clearLedgers(folder);

        // Then - nothing is left
        expect(existsSync(folder)).toBe(false);
    });
});
