import { ruleTester } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { MAX_SPEC_LINES } from '../../../kit/project/specs-modules.js';
import { groupsOf, specFileWithinLineLimit } from './spec-file-within-line-limit.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

function specOf(lines: number, titles: string[]): string {
    const body = titles.map((title) => `test('${title}', () => {});`);
    return [...body, ...Array.from({ length: lines - body.length }, () => '// …')].join('\n');
}

ruleTester().run('spec-file-within-line-limit', specFileWithinLineLimit, {
    invalid: [
        {
            code: specOf(MAX_SPEC_LINES + 1, ['rejects a', 'rejects b', 'accepts a']),
            errors: [
                {
                    column: 0,
                    line: 1,
                    message:
                        /fix: cut it along its tests’ groups — "rejects" \(2\), "accepts" \(1\)/u,
                },
            ],
            filename: SPEC,
        },
    ],
    valid: [
        { code: specOf(MAX_SPEC_LINES, ['rejects a']), filename: SPEC },
        // A module test is not a spec.
        { code: specOf(MAX_SPEC_LINES + 50, ['a']), filename: '/repo/src/events/list.test.ts' },
    ],
});

describe('specFileWithinLineLimit', () => {
    test('spec-file-within-line-limit — specFileWithinLineLimit — groupsOf — the cut a long file suggests — groups titles by what stands before a dash or a colon, else by their first word', () => {
        // Given - titles of three shapes
        const titles = [
            'pagination — the first page',
            'pagination — the last page',
            'filters: by date',
            'rejects a negative page',
        ];

        // Then - the largest group first, each with its count
        expect(groupsOf(titles)).toBe('"pagination" (2), "filters" (1), "rejects" (1)');
    });
});
