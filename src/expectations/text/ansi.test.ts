import { describe, expect, test } from 'vitest';

import { stripAnsiCodes } from './ansi.js';

describe('stripAnsiCodes', () => {
    test('a coloured line — keeps the text, drops every colour and style sequence', () => {
        // Given - a report line a linter coloured: red, bold, then a reset
        const coloured = '\u001B[31m\u001B[1merror\u001B[0m unused-var.ts:1:7';

        // Then - what a golden compares is the text alone (`no-transform-duplicating-tokens`)
        expect(stripAnsiCodes(coloured)).toBe('error unused-var.ts:1:7');
    });
});
