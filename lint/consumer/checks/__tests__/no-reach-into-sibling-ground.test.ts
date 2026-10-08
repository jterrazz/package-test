import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkNoReachIntoSiblingGround } from '../no-reach-into-sibling-ground.js';

const reading = (...paths: string[]): string =>
    `test('lists users', async () => {\n${paths.map((path) => `    await read(file('${path}'));\n`).join('')}});\n`;

describe('checkNoReachIntoSiblingGround', () => {
    test('a reader reaches its own ground, the ground of a folder above it and the specs root’s, never a sibling’s', () => {
        // Given - ground at the specs root, above the leaf, in the leaf and in a sibling leaf
        const root = packageWith({
            'specs/__expected__/pool.json': '[]\n',
            'specs/api/__expected__/above.json': '[]\n',
            'specs/api/orders/__expected__/sibling.json': '[]\n',
            'specs/api/users/__expected__/own.json': '[]\n',
            'specs/api/users/users.spec.ts': reading(
                './__expected__/own.json',
                '../../__expected__/pool.json',
                '../__expected__/above.json',
                '../orders/__expected__/sibling.json',
            ),
        });

        // Then - the sibling reach is found, nothing else
        expect(
            checkNoReachIntoSiblingGround(root).map(
                ({ column, fix, found, line, path, rule }) =>
                    `${rule} ${path}:${line}:${column ?? '-'} ${found} — ${fix}`,
            ),
        ).toStrictEqual([
            'no-reach-into-sibling-ground specs/api/users/users.spec.ts:5:21 "../orders/__expected__/sibling.json" leaves specs/api/users — move what it names beside specs/api/users, or — when several leaves share it — into the ground of the lowest folder they share, which each reaches by climbing: specs/<role>/ when they span specifications',
        ]);
    });
});
