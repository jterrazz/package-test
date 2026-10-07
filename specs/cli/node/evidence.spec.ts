import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('evidence', () => {
    test("a run's start sweeps the evidence of every run that ended, and keeps a living run's", async () => {
        // Given - an evidence folder holding a living run's, a finished run's, and a folder no run named
        const result = await cli
            .fixture(directory('./__fixtures__/evidence/'))
            .exec('node run.mjs');

        // Then - the living run's evidence is all that is left
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            evidence kept: <a living run>
        `);
    });
});
