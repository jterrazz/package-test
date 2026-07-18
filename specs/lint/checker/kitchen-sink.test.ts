import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — checker kitchen-sink (CONVENTIONS D11)', () => {
    // The D11 regression net: ONE fixture project that trips every checker pass
    // At once — D4 unknown + malformed tokens, D4b http first line, D10 token
    // Leak, C9 dead fixture, B5 await-using inference and A7 database — asserted
    // As a single full-output golden. It churns as the diagnostic surface
    // Evolves; that is its job (the checker output is OURS, so D11(d) is moot).
    test('surfaces every diagnostic in one run', async () => {
        // Given - a specs tree that violates all of the checker passes
        const result = await cli
            .fixture('$FIXTURES/lint-violations/checker-kitchen-sink/')
            .exec('.');

        // Then - the whole diagnostic block is asserted (the D10 line's echoed
        // {{uuid}} token is covered by {{string}}; a literal token in the golden
        // Would itself be read as a placeholder by the grammar — see D4)
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('kitchen-sink.txt');
    });
});
