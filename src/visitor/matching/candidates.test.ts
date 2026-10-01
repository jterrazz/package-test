import { describe, expect, test } from 'vitest';

import { MATCH_TEXT_LENGTH, shortened } from './candidates.js';

describe('candidates', () => {
    test('shortened — collapses whitespace so a candidate reads on one line', () => {
        // Given - a text broken across lines by its markup
        const text = '  Read\n   the   Articles  ';

        // Then - one space between words, none around them
        expect(shortened(text)).toBe('Read the Articles');
    });

    test('shortened — cuts a long text at the length every surface lists', () => {
        // Given - a text longer than a candidate line holds
        const text = 'a'.repeat(MATCH_TEXT_LENGTH + 20);

        // Then - it stops at the shared length
        expect(shortened(text)).toHaveLength(MATCH_TEXT_LENGTH);
    });
});
