import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

describe('branch', () => {
    test('a variable set on a branch never reaches the chain it forked from', async () => {
        // Given - a chain stating a variable, and a branch of it overriding it, run first
        const stated = cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .env({ MY_VAR: 'chain' });
        await stated.env({ MY_VAR: 'branch' }).exec('env');

        // When - the chain it forked from runs
        const result = await stated.exec('env');

        // Then - the command saw the chain's own value, never the branch's
        expect(result.stdout.text).toContain('MY_VAR=chain');
    });
});
