import { describe, expect, test } from 'vitest';

import type { Row } from '../catalogue/row.js';
import { teacherOf, underTree } from './teacher.js';

function spottedAt(path: string): {
    fix: string;
    found: string;
    line: number;
    path: string;
    rule: string;
} {
    return { fix: '', found: '', line: 1, path, rule: 'r' };
}

const PROBE: Row = {
    audience: 'consumer',
    channel: 'checker',
    specification: 'model',
    family: 'layout',
    fix: 'A probe fix.',
    name: 'probe-rule',
    rationale: 'A probe rationale.',
    reach: 'tests',
    sentence: 'A probe.',
};

describe('teacher', () => {
    test('teacherOf — each spotted finding taught by its rule, at its column or the first', () => {
        // Given - two findings of one rule, one placed on a column and one not
        const teach = teacherOf({ chapter: 'docs/probe.md', rows: [PROBE] });
        const spotted = [
            {
                column: 7,
                fix: 'a',
                found: 'b',
                line: 2,
                path: 'specs/a.spec.ts',
                rule: 'probe-rule',
            },
            { fix: 'c', found: 'd', line: 5, path: 'specs/b.spec.ts', rule: 'probe-rule' },
        ];

        // Then - each at its place, read under the rule's id
        expect(
            teach(spotted).map(
                ({ column, line, path, rule }) => `${rule} ${path}:${line}:${column}`,
            ),
        ).toStrictEqual([
            'jterrazz-check/probe-rule specs/a.spec.ts:2:7',
            'jterrazz-check/probe-rule specs/b.spec.ts:5:1',
        ]);
    });

    test('underTree — findings of a tree are read from above it, and a root tree leaves them as they are', () => {
        // Given - findings read from a member, and from the root

        // Then - the member's prefixed, the root's untouched
        expect([
            underTree([spottedAt('specs/a.ts')], 'packages/app').map(({ path }) => path),
            underTree([spottedAt('specs/a.ts')], '').map(({ path }) => path),
        ]).toStrictEqual([['packages/app/specs/a.ts'], ['specs/a.ts']]);
    });
});
