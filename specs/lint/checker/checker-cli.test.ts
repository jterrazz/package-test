import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — checker CLI contract', () => {
    // Scalpel (D11): targeted exit-code + message probe on the CLI boundary — a
    // Full-output golden would couple this to the diagnostic formatting.
    test('a nonexistent root fails loudly instead of reporting a clean tree', async () => {
        // Given - a target directory that does not exist
        const result = await cli.exec('does-not-exist-xyz');

        // Then - the checker rejects it (exit 1) rather than passing vacuously
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('no such directory');
    });
});
