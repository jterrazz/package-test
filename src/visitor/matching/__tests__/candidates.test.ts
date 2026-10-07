import { describe, expect, test } from 'vitest';

import {
    CANDIDATE_LIMITS,
    MATCH_TEXT_LENGTH,
    MAX_REPORTED_MATCHES,
    shortened,
} from '../candidates.js';
import { LANDMARK_SELECTOR } from '../landmark-of-tag.js';

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

    test('the limits handed into the page are the module limits, the landmark selector with them', () => {
        // Given - what the page script is handed, since it reads nothing from module scope
        const limits = CANDIDATE_LIMITS;

        // Then - the selector, the report cap and the text length
        expect(limits).toStrictEqual({
            landmarks: LANDMARK_SELECTOR,
            limit: MAX_REPORTED_MATCHES,
            textLength: MATCH_TEXT_LENGTH,
        });
    });
});
