import { describe, expect, test } from 'vitest';

import { withoutEmptiedGroups, withoutLooseComments } from '../spec-in-subject-folder.cut.js';

describe('spec-in-subject-folder.cut', () => {
    test('withoutLooseComments — a header, a note above a blank line and a closing note go; a note above code, a trailing one on a line of code and a comment inside a group stay', () => {
        // Given - every place a comment stands in a spec the cut left
        const text = [
            '/*',
            ' * The database resets before each chain.',
            ' */',
            '',
            "import { api } from '../api.specification.js';",
            '',
            '// a note on what follows',
            '',
            '// the status every answer carries',
            'const OK = 200; // a trailing note',
            '',
            "describe('orders', () => {",
            '    // a comment inside the group',
            '',
            "    test('lists', async () => { await api.get('/orders'); });",
            '});',
            '// the closing words',
        ].join('\n');

        // Then - only the comments that stand alone at module scope are gone, the code byte for byte
        expect(withoutLooseComments(text)).toBe(
            [
                "import { api } from '../api.specification.js';",
                '',
                '// the status every answer carries',
                'const OK = 200; // a trailing note',
                '',
                "describe('orders', () => {",
                '    // a comment inside the group',
                '',
                "    test('lists', async () => { await api.get('/orders'); });",
                '});',
                '',
            ].join('\n'),
        );
    });

    test('withoutLooseComments — a line of blanks ends a comment as an empty line does', () => {
        // Given - a header, then a line holding spaces alone
        const text = '// the header\n    \nconst OK = 200;\n';

        // Then - the header and its blank line are gone
        expect(withoutLooseComments(text)).toBe('const OK = 200;\n');
    });

    test('withoutLooseComments — a text with no loose comment comes back as it was', () => {
        // Given - code with a comment above a declaration
        const text = '// the one constant\nconst OK = 200;\n';

        // Then - unchanged
        expect(withoutLooseComments(text)).toBe(text);
    });

    test('withoutEmptiedGroups — a group the cut emptied goes with the comment above it; a group still holding a test keeps its title', () => {
        // Given - a group left with no test, then one still holding a test
        const text = [
            '// the reading group',
            "describe('reading', () => {",
            '    beforeEach(reset);',
            '});',
            "describe('writing', () => {",
            "    test('creates', () => {});",
            '});',
            '',
        ].join('\n');

        // Then - the writing group, as it was
        expect(withoutEmptiedGroups(text)).toBe(
            "describe('writing', () => {\n    test('creates', () => {});\n});\n",
        );
    });

    test('withoutEmptiedGroups — a skipped group, spaced from its call, and a table of groups, emptied, go whole; a group nested in one that holds a test stays', () => {
        // Given - an emptied skipped group, an emptied table spanning lines, and a group holding an emptied one
        const text = [
            "describe.skip ('reading', () => {",
            '    beforeEach(reset);',
            '});',
            "describe.each([1, 2])('page %s', (n) => {",
            '    beforeEach(reset);',
            '});',
            "describe('writing', () => {",
            "    describe('inner', () => {",
            '        beforeEach(reset);',
            '    });',
            "    test('creates', () => {});",
            '});',
            '',
        ].join('\n');

        // Then - the writing group alone, as it was
        expect(withoutEmptiedGroups(text)).toBe(text.slice(text.indexOf("describe('writing'")));
    });
});
