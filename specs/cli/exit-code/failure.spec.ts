import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* invariant: capability probes of stream capture and lifecycle, not of the fixture CLI's output (`output-asserted-as-a-golden` scalpel). */

describe('failure', () => {
    test('captures non-zero exit code', async () => {
        // Given - a command that exits 2
        const result = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('fail');

        // Then - the exit code is preserved
        expect(result.exitCode).toBe(2);
    });

    test('multi-exec — stops on first failure', async () => {
        // Given - fail then build (fail exits non-zero, build should not run)
        const result = await cli
            .fixture(directory('../_fixtures/specimen-cli/'))
            .exec(['fail', 'build']);

        // Then - stopped at fail
        expect(result.exitCode).toBe(2);
        expect(result.stderr.text).toContain('Fatal: something went wrong');
    });
});
