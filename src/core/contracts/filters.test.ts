import { describe, expect, test } from 'vitest';

import { match } from '../matching/match.js';
import { matchesText } from './filters.js';

describe('matchesText', () => {
    test('an omitted filter matches anything', () => {
        // Given - no filter declared
        // Then - every observed text satisfies it
        expect(matchesText(undefined, 'anything at all')).toBe(true);
    });

    test('a string filter is EXACT, never a substring', () => {
        // Given - a filter that is a prefix of the observed prompt
        const filter = 'Classify the article';

        // Then - only the identical text matches
        expect(matchesText(filter, 'Classify the article')).toBe(true);
        expect(matchesText(filter, 'Classify the article into TECH')).toBe(false);
    });

    test('a RegExp filter tests the observed text', () => {
        // Given - a pattern filter
        // Then - it matches by pattern, not by equality
        expect(matchesText(/Classify/u, 'Please: Classify the article')).toBe(true);
        expect(matchesText(/Summarize/u, 'Please: Classify the article')).toBe(false);
    });

    test('match.includes is the explicit containment escape', () => {
        // Given - the code-only containment matcher
        const filter = match.includes('Classify the article');

        // Then - a longer prompt carrying the prefix matches
        expect(matchesText(filter, 'Classify the article into TECH')).toBe(true);
        expect(matchesText(filter, 'Summarize the article')).toBe(false);
    });

    test('any other match.* matcher goes through the structural engine', () => {
        // Given - a typed matcher on the observed text
        // Then - the same engine the assertions use decides
        expect(matchesText(match.uuid(), '3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
        expect(matchesText(match.uuid(), 'not-a-uuid')).toBe(false);
    });
});
