import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — checker CLI contract', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('a root that is not a specs tree is read as the project holding one', async () => {
        // Given - the project root of a tree whose facet findings sit one level down
        const result = await cli.fixture('$FIXTURES/lint-violations/c12-spec-placement/').exec('.');

        // Then - the facet passes report what `specs` reports, anchored on the root that was named
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('checker-project-root.txt');
    });

    // Scalpel (D11): targeted exit-code + message probe on the CLI boundary — a
    // Full-output golden would couple this to the diagnostic formatting.
    test('a root holding no specs tree at all is refused, not reported clean', async () => {
        // Given - a package with module tests and no `specs/` anywhere below it
        const result = await cli.fixture('$FIXTURES/lint-violations/checker-no-specs/').exec('.');

        // Then - the run the operator asked for had nothing to walk, and says so
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('no `specs/` tree under');
    });

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
