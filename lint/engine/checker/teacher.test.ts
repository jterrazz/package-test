import { describe, expect, test } from 'vitest';

import type { Row } from '../catalogue/row.js';
import { teacherOf, underTree } from './teacher.js';

const ROW: Row = {
    audience: 'consumer',
    channel: 'checker',
    facet: 'model',
    family: 'layout',
    fix: 'Move it.',
    name: 'no-stray-file',
    rationale: 'A stray file is read by nobody.',
    reach: 'spec',
    sentence: 'No file strays from its folder. It is read where it sits.',
};

describe('teacher', () => {
    test('teacherOf — a spotted teaching — becomes the finding its row teaches, at its position', () => {
        // Given - a check's spot under a specs tree
        const teach = teacherOf({ chapter: 'docs/19-linting.md', rows: [ROW] });
        const spotted = underTree(
            [
                {
                    fix: 'move it home',
                    found: 'a stray file',
                    line: 3,
                    path: 'a.ts',
                    rule: 'no-stray-file',
                },
            ],
            'specs',
        );

        // Then - the kit's finding: the rule namespaced, the lesson in four parts, the position kept
        expect(teach(spotted)).toStrictEqual([
            {
                column: 1,
                line: 3,
                message:
                    'found: a stray file · why: No file strays from its folder. · fix: move it home · read: docs/19-linting.md#no-stray-file',
                path: 'specs/a.ts',
                rule: 'jterrazz-check/no-stray-file',
            },
        ]);
    });

    test('teacherOf — a rule no row holds — is refused, never taught with no lesson', () => {
        // Given - a spot naming a rule the catalogue lacks
        const teach = teacherOf({ chapter: 'docs/19-linting.md', rows: [ROW] });

        // Then - the kit's refusal names the missing row
        expect(() =>
            teach([{ fix: 'x', found: 'y', line: 1, path: 'a.ts', rule: 'no-such-rule' }]),
        ).toThrow('found: no catalogue row is named `no-such-rule`');
    });
});
