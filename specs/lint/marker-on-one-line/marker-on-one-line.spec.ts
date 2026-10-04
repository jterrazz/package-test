import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

describe('marker-on-one-line', () => {
    test('accepts one-line markers and a note set apart by a blank line', async () => {
        // Given - the compliant tree
        const result = await lint.fixture(directory('./_fixtures/compliant/')).run();

        // Then - nothing is reported
        expect(result.report).toMatch('');
    });

    test('rejects a marker wrapped onto a second comment line', async () => {
        // Given - the violation tree
        const result = await lint.fixture(directory('./_fixtures/violation/')).run();

        // Then - each finding at its line and column, with its lesson
        expect(result.report).toMatch(`
            scenario.test.ts:7:5  jterrazz(marker-on-one-line)
                found: a marker continued on the comment line under it
                why: A marker is exactly one line: a \`//\` comment directly under one, at the same indentation, is a wrapped marker and an error.
                fix: fold the continuation into the marker's one line, or separate the two with a blank line
                read: docs/reference/linting.md#marker-on-one-line
        `);
    });
});
