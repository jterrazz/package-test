import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

const WORKSPACE = resolve(import.meta.dirname, '../../_shared/_fixtures/member-workspace');

describe('file-suffix-matches-place', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('rejects a case name that only repeats its directory', async () => {
        // Given - specs/rm/rm.spec.yaml
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/file-suffix-matches-place/'))
            .exec('.');

        // Then - the pass names the document, the line and what to write instead
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/rm/rm.spec.yaml:1:1: error jterrazz-check(file-suffix-matches-place): found: "rm.spec.yaml" repeats its directory "rm/" · why: The suffix says the kind, and the tree agrees with it. · fix: name it for what this case proves, not where it sits · read: docs/19-linting.md#file-suffix-matches-place

            conventions checker: 1 error(s) found under {{workdir}}
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('accepts a document that holds the convention', async () => {
        // Given - the compliant twin every document pass shares
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/spec-document-ok/'))
            .exec('.');

        // Then - the clean summary (0 warnings) on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./_expected/clean.txt'));
    });

    test('renames a `.test.ts` that sits under a facet folder', async () => {
        // Given - a tree holding `specs/api/users/creation.test.ts`
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/file-suffix-matches-place-placement/'))
            .exec('specs');

        // Then - the facet folder already says what it specifies; only the word is wrong
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            api/users/creation.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a \`.test.ts\` under \`specs/api/\`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it \`api/users/creation.spec.ts\` — \`make fix\` does it with \`git mv\` · read: docs/19-linting.md#file-suffix-matches-place
            api/helpers/normalize.test.ts:1:1: error jterrazz-check(facet-test-uses-its-runner): found: a test under the \`api\` facet that reaches no runner · why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself. · fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module · read: docs/19-linting.md#facet-test-uses-its-runner

            conventions checker: 2 error(s) found under {{workdir}}/specs
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('renames the spec, and leaves the two files that are not its own', async () => {
        // Given - the same tree, where `specs/build/` is a repository suite and `specs/api/helpers/normalize.test.ts` reaches no runner
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/file-suffix-matches-place-placement/'))
            .exec('specs --fix');

        // Then - one rename; the glob and the literal entry it broke, and nothing else: not the commented-out glob, not the `src/` one whose files it never touched, not the repository suite's
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            conventions checker: renamed api/users/creation.test.ts → api/users/creation.spec.ts (file-suffix-matches-place)
            conventions checker: vitest.config.ts: specs/api/**/*.test.ts still names \`.test.ts\` — the files it collected are \`.spec.ts\` now, and the project collects nothing until the glob follows (file-suffix-matches-place)
            conventions checker: vitest.config.ts: specs/api/users/creation.test.ts names a file this run renamed — it is \`specs/api/users/creation.spec.ts\` now, and the entry collects nothing until it follows (file-suffix-matches-place)
        `);
        expect(result.stderr).toMatch(`
            api/helpers/normalize.test.ts:1:1: error jterrazz-check(facet-test-uses-its-runner): found: a test under the \`api\` facet that reaches no runner · why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself. · fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module · read: docs/19-linting.md#facet-test-uses-its-runner

            conventions checker: 1 error(s) found under {{workdir}}/specs
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test("renames under a tree that is one facet's whole, with no facet level", async () => {
        // Given - a tree whose runner sits at its ROOT: the folders below it are domains, not facets
        const result = await cli
            .fixture(
                directory('./_fixtures/lint-violations/file-suffix-matches-place-rooted-facet/'),
            )
            .exec('specs');

        // Then - the spec is named, and the ground module's own test beside its module is not
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            operator/manifest/manifest.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a \`.test.ts\` under \`specs/\`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it \`operator/manifest/manifest.spec.ts\` — \`make fix\` does it with \`git mv\` · read: docs/19-linting.md#file-suffix-matches-place

            conventions checker: 1 error(s) found under {{workdir}}/specs
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test("names a `.spec.ts` at a member's own root, the one place ls-lint never judges", async () => {
        // Given - a member holding `creation.spec.ts` at its root
        const result = await cli.exec(`--member ${WORKSPACE}/packages/stray-spec ${WORKSPACE}`);

        // Then - the member pass is the only run that sees outside a specs tree
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain(
            "found: a `.spec.ts` at the project's root, outside every `specs/` tree",
        );
    });
});
