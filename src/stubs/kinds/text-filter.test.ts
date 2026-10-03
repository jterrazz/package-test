import { describe, expect, test } from 'vitest';

import { match } from '../../expectations/tokens/match.js';
import { fieldOf, listOf, matchesText, messageText, namesOf } from './text-filter.js';

describe('text-filter', () => {
    test('matchesText — an omitted filter matches anything', () => {
        // Given - no filter declared
        // Then - every observed text satisfies it
        expect(matchesText(undefined, 'anything at all')).toBe(true);
    });

    test('matchesText — a string filter is EXACT, never a substring', () => {
        // Given - a filter that is a prefix of the observed prompt
        const filter = 'Classify the article';

        // Then - only the identical text matches
        expect(matchesText(filter, 'Classify the article')).toBe(true);
        expect(matchesText(filter, 'Classify the article into TECH')).toBe(false);
    });

    test('matchesText — a RegExp filter tests the observed text', () => {
        // Given - a pattern filter
        // Then - it matches by pattern, not by equality
        expect(matchesText(/Classify/u, 'Please: Classify the article')).toBe(true);
        expect(matchesText(/Summarize/u, 'Please: Classify the article')).toBe(false);
    });

    test('matchesText — match.includes is the explicit containment escape', () => {
        // Given - the code-only containment matcher
        const filter = match.includes('Classify the article');

        // Then - a longer prompt carrying the prefix matches
        expect(matchesText(filter, 'Classify the article into TECH')).toBe(true);
        expect(matchesText(filter, 'Summarize the article')).toBe(false);
    });

    test('matchesText — any other match.* matcher goes through the structural comparison', () => {
        // Given - a typed matcher on the observed text
        // Then - the same comparison the assertions make decides
        expect(matchesText(match.uuid(), '3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
        expect(matchesText(match.uuid(), 'not-a-uuid')).toBe(false);
    });

    test('matchesText — a string filter holding a token is still exact: the token is text', () => {
        // Given - a filter written with what reads as a token
        // Then - only the identical text matches
        expect([
            matchesText('id {{uuid}}', 'id {{uuid}}'),
            matchesText('id {{uuid}}', 'id 3f2504e0-4f89-41d3-9a0c-0305e82c3301'),
        ]).toStrictEqual([true, false]);
    });

    test('the request readers — a field of an object alone, a list or none, the first message of a role as text, and the names a tool list states', () => {
        // Given - messages with text, structured and missing contents, and tools with and without names
        const messages = [
            { content: 'first', role: 'user' },
            { content: 'second', role: 'user' },
            { content: [{ text: 'x' }], role: 'tool' },
            { content: 5, role: 'system' },
            { role: 'assistant' },
        ];
        const tools = [{ name: 'a' }, {}, { name: 'b' }, 'bare'];

        // Then - each reading
        expect([
            [
                fieldOf({ a: 1 }, 'a'),
                fieldOf({ a: 1 }, 'b'),
                fieldOf(null, 'a'),
                fieldOf([1], '0'),
                fieldOf('text', 'length'),
            ],
            [listOf([1]), listOf('x'), listOf(null)],
            ['user', 'tool', 'system', 'assistant', 'developer'].map((role) =>
                messageText(messages, role),
            ),
            namesOf(tools, (tool) => fieldOf(tool, 'name')),
        ]).toStrictEqual([
            [1, undefined, undefined, undefined, undefined],
            [[1], [], []],
            ['first', '[{"text":"x"}]', '5', '', ''],
            ['a', 'b'],
        ]);
    });
});
