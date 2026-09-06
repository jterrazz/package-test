import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

describe('lint — b4 cli header (CONVENTIONS B4)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects a literate .cli whose header is missing a narrative line', async () => {
        // Given - a specs tree holding a <case>.cli with no `then:` line
        const result = await cli.fixture('$FIXTURES/lint-violations/b4-cli-header/').exec('.');

        // Then - B4 reaches the literate format: the header IS the narration
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('b4-cli-header.txt');
    });

    test('accepts a literate .cli carrying test, given and then', async () => {
        // Given - the compliant twin
        const result = await cli.fixture('$FIXTURES/lint-violations/b4-cli-header-ok/').exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });
});
