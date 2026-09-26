import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

/* Capability probes of stream capture and lifecycle, not of the fixture CLI's output (`output-asserted-as-a-golden` scalpel). */

describe('unknown-command', () => {
    test('captures unknown command failure', async () => {
        // Given - a command the fixture does not know
        const result = await cli
            .fixture(directory('../../_shared/_fixtures/specimen-cli/'))
            .exec('nonexistent');

        // Then - non-zero exit with a useful stderr
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('Unknown command');
    });
});
