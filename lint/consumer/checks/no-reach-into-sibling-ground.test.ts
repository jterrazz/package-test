import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import {
    checkNoReachIntoSiblingGround,
    fixNoReachIntoSiblingGround,
} from './no-reach-into-sibling-ground.js';

const reading = (...paths: string[]): string =>
    `test('lists users', async () => {\n${paths.map((path) => `    await read(file('${path}'));\n`).join('')}});\n`;

describe('no-reach-into-sibling-ground', () => {
    test('a reader reaches its own ground, the ground of a folder above it and the shared pools, never a sibling’s', () => {
        // Given - ground at the specs root, in the shared pool, above the leaf, in the leaf and in a sibling leaf
        const root = packageWith({
            'specs/_expected/root.json': '[]\n',
            'specs/_shared/_expected/pool.json': '[]\n',
            'specs/api/_expected/above.json': '[]\n',
            'specs/api/orders/_expected/sibling.json': '[]\n',
            'specs/api/users/_expected/own.json': '[]\n',
            'specs/api/users/users.spec.ts': reading(
                './_expected/own.json',
                '../../_shared/_expected/pool.json',
                '../_expected/above.json',
                '../orders/_expected/sibling.json',
                '../../_expected/root.json',
            ),
        });

        // Then - the root ground and the sibling reach are found, nothing else
        expect(
            checkNoReachIntoSiblingGround(root).map(
                ({ column, fix, found, line, path, rule }) =>
                    `${rule} ${path}:${line}:${column ?? '-'} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'no-reach-into-sibling-ground specs/_expected:1:- _expected/ at the specs root, shared ground outside specs/_shared/ — move it to specs/_shared/_expected/ — `typescript fix` moves it and rewrites every whole relative path that names it',
            'no-reach-into-sibling-ground specs/api/users/users.spec.ts:5:21 "../orders/_expected/sibling.json" leaves specs/api/users — move what it names beside specs/api/users, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: specs/_shared/<role>/ when they span specifications',
            'no-reach-into-sibling-ground specs/api/users/users.spec.ts:6:21 "../../_expected/root.json" leaves specs/api/users — move what it names beside specs/api/users, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: specs/_shared/<role>/ when they span specifications',
        ]);
    });

    test('the fix moves the root ground into the shared pool and repoints its readers, leaving an entry the pool already holds', () => {
        // Given - root ground read from a leaf and a module test, one folder whose every entry the pool already holds, one entry of another too
        const root = packageWith({
            'specs/_expected/moved.json': '[1]\n',
            'specs/_expected/other.json': '[4]\n',
            'specs/_expected/taken.json': '[2]\n',
            'specs/_fixtures/held.json': '[5]\n',
            'specs/_requests/create.http': 'POST /users\n',
            'specs/_shared/_expected/taken.json': '[3]\n',
            'specs/_shared/_fixtures/held.json': '[6]\n',
            'specs/api/users/users.spec.ts': reading(
                '../../_expected/moved.json',
                '../../_expected/other.json',
                '../../_requests/create.http',
            ),
            'src/reads.test.ts': "const path = '../specs/_expected/moved.json';\n",
        });

        // When - the fixer runs
        const moved = fixNoReachIntoSiblingGround(root);

        // Then - the free entries moved and their readers follow, an emptied folder is gone; what the pool held stays where it was
        const at = (path: string): string | undefined =>
            existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : undefined;
        expect([
            moved,
            at('specs/_shared/_expected/moved.json'),
            at('specs/_expected/taken.json'),
            at('specs/_fixtures/held.json'),
            existsSync(join(root, 'specs/_requests')),
            at('specs/api/users/users.spec.ts'),
            at('src/reads.test.ts'),
        ]).toStrictEqual([
            [
                'specs/_expected/ → specs/_shared/_expected/',
                'specs/_requests/ → specs/_shared/_requests/',
            ],
            '[1]\n',
            '[2]\n',
            '[5]\n',
            false,
            reading(
                '../../_shared/_expected/moved.json',
                '../../_shared/_expected/other.json',
                '../../_shared/_requests/create.http',
            ),
            "const path = '../specs/_shared/_expected/moved.json';\n",
        ]);
    });
});
