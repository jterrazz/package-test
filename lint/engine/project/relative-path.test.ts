import { describe, expect, test } from 'vitest';

import { isRelativePath } from './relative-path.js';

describe('isRelativePath', () => {
    test('relative-path — isRelativePath — a path is relative when it starts where the spec file is', () => {
        // Given - paths from the spec file, a bare name, a marker and an absolute path
        const paths = ['./expected/out.txt', '../fixtures/shop/', 'out.txt', '$FIXTURES/x', '/abs'];

        // Then - only the two that start at ./ or ../ are relative
        expect(paths.map(isRelativePath)).toStrictEqual([true, true, false, false, false]);
    });
});
