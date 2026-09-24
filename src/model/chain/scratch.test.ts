import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { scratchDirectory } from './scratch.js';

describe('scratchDirectory() — a fresh folder that ends with its test', () => {
    test('is empty, under the temp directory, and removed once the test has finished', () => {
        // Given - a check that runs after the test's own teardowns
        let directory = '';
        onTestFinished(() => {
            expect(existsSync(directory)).toBe(false);
        });

        // When - the test asks for a scratch folder
        directory = scratchDirectory('scratch-');

        // Then - it is there, empty, under the temp directory, for the length of the test
        expect(dirname(directory)).toBe(tmpdir());
        expect(readdirSync(directory)).toStrictEqual([]);
    });
});
