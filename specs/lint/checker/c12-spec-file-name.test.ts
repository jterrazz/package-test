import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker.specification.js';

/** The fixture workspace the member pass is exercised against. */
const WORKSPACE = resolve(import.meta.dirname, '../../_fixtures/member-workspace');

describe('lint — c12 spec file name (CONVENTIONS C12)', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stderr is asserted, tokens covering the run cwd.
    test('rejects a case name that only repeats its directory', async () => {
        // Given - specs/rm/rm.spec.yaml
        const result = await cli.fixture('$FIXTURES/lint-violations/c12-spec-file-name/').exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c12-spec-file-name.txt');
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli.fixture('$FIXTURES/lint-violations/spec-document-ok/').exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('clean.txt');
    });

    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('renames a `.test.ts` that sits under a facet folder', async () => {
        // Given - a tree holding `specs/api/users/creation.test.ts`
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c12-spec-placement/')
            .exec('specs');

        // Then - the facet folder already says what it specifies; only the word is wrong
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch('c12-spec-placement.txt');
    });

    test('renames the spec, and leaves the two files that are not its own', async () => {
        // Given - the same tree, where `specs/build/` is a repository suite and `specs/api/helpers/normalize.test.ts` reaches no runner
        const result = await cli
            .fixture('$FIXTURES/lint-violations/c12-spec-placement/')
            .exec('specs --fix');

        // Then - one rename: `specs/build/` is nobody's facet, and the module test parked under one is C18's to MOVE, not this rule's to rename
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch('c12-spec-placement-fixed.txt');
        expect(result.stderr).toMatch('c12-spec-placement-left.txt');
    });

    test('names a `.spec.ts` that never reached a specs tree', async () => {
        // Given - a member holding `src/creation.spec.ts`
        const result = await cli.exec(`--member ${WORKSPACE}/packages/stray-spec ${WORKSPACE}`);

        // Then - the member pass is the only run that sees outside a specs tree
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('a `.spec.ts` lives under `specs/<facet>/`');
    });
});
