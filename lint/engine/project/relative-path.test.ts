import { describe, expect, test } from 'vitest';

import { isRelativePath, requireRelativePath } from './relative-path.js';

describe('relative-path', () => {
    test('isRelativePath — a path is relative when it starts where the spec file is', () => {
        // Given - paths from the spec file, a bare name, a marker and an absolute path
        const paths = ['./expected/out.txt', '../fixtures/shop/', 'out.txt', '$FIXTURES/x', '/abs'];

        // Then - only the two that start at ./ or ../ are relative
        expect(paths.map(isRelativePath)).toStrictEqual([true, true, false, false, false]);
    });

    test('requireRelativePath — refuses a path that is not relative, naming the call and the form to write', () => {
        // Given - a verb handed a bare name
        // Then - the refusal is the four-part lesson of its catalogue row
        expect(() => {
            requireRelativePath('seed', 'users.sql');
        }).toThrow(
            /^found: seed\("users\.sql"\), a path that is not relative to the spec file\nwhy: .*\nfix: start it with \.\/ or \.\.\/, from the spec file: seed\('\.\/users\.sql'\)\nread: docs\/19-linting\.md#disk-named-by-relative-path-at-runtime$/u,
        );
    });
});
