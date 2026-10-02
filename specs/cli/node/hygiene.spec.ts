import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('hygiene', () => {
    test('a project the installed preset builds gives back the spies, variables and globals a test stubbed', async () => {
        // Given - a consumer's test stubbing all three and restoring none, then a test reading them
        const result = await cli.fixture(directory('./_fixtures/hygiene/')).exec('node run.mjs');

        // Then - the second test finds the real ones: the preset restored them between tests
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            src/restores.test.ts > a test stubs a spy, a variable and a global, and cleans none of them up: passed
            src/restores.test.ts > the next test finds the real ones: passed
        `);
    });
});
