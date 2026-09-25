import { describe, expect, test } from 'vitest';

import { asOxlintRule, ruleTester } from '../../rule-tester.fixtures.js';
import { c33FileSize, groupsOf, MAX_SPEC_LINES } from './c33-file-size.js';

const SPEC = '/repo/specs/api/events/list/pagination.spec.ts';

/** A spec of `lines` lines: tests, padded with comment lines. */
function specOf(lines: number, titles: string[]): string {
    const body = titles.map((title) => `test('${title}', () => {});`);
    return [...body, ...Array.from({ length: lines - body.length }, () => '// …')].join('\n');
}

ruleTester().run('c33-file-size', asOxlintRule(c33FileSize), {
    invalid: [
        {
            code: specOf(MAX_SPEC_LINES + 1, ['rejects a', 'rejects b', 'accepts a']),
            errors: [
                {
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

describe('c33FileSize', () => {
    test('groupsOf — the cut a long file suggests — groups titles by what stands before a dash or a colon, else by their first word', () => {
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
