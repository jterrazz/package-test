import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { TEMP_ROOTS_PARENT } from '../../runner/temp-root.js';
import { scratchDirectory } from './scratch.js';

describe('scratchDirectory() — a fresh folder that ends with its test', () => {
    test('is empty, in the run temp root, and removed once the test has finished', () => {
        // Given - a check that runs after the test's own teardowns
        let directory = '';
        onTestFinished(() => {
            expect(existsSync(directory)).toBe(false);
        });

        // When - the test asks for a scratch folder
        directory = scratchDirectory('scratch-');

        // Then - it is there, empty, in the run's temp root, for the length of the test
        const root = tmpdir();
        expect(dirname(directory)).toBe(root);
        expect(basename(dirname(root))).toBe(TEMP_ROOTS_PARENT);
        expect(readdirSync(directory)).toStrictEqual([]);
    });
});

describe.concurrent('scratchDirectory() under concurrent tests — left to the run root', () => {
    const siblingStarted = Promise.withResolvers<true>();
    const asked = Promise.withResolvers<string>();
    const siblingFinished = Promise.withResolvers<true>();

    test('outlives a sibling test that finishes first', async () => {
        // Given - a sibling test running alongside
        await siblingStarted.promise;

        // When - this test asks for a scratch folder, and works on past the sibling's end
        const directory = scratchDirectory('scratch-');
        asked.resolve(directory);
        await siblingFinished.promise;

        // Then - the folder is still there
        expect(existsSync(directory)).toBe(true);
    });

    test('a sibling that finishes first', async ({ onTestFinished: whenFinished }) => {
        // Given - a signal sent once this test's own finish hooks have run
        whenFinished(() => {
            siblingFinished.resolve(true);
        });
        siblingStarted.resolve(true);

        // When - the other test asks for its folder
        const directory = await asked.promise;

        // Then - the folder is there while this test runs
        expect(existsSync(directory)).toBe(true);
    });
});
