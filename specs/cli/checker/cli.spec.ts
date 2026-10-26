import { directory, file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker-cli.specification.js';

describe('cli', () => {
    // invariant: the checker's diagnostics are this package's product, so the whole stream is goldened.
    test('lint — checker CLI contract — a root that is not a specs tree is read as the project holding one', async () => {
        // Given - the project root of a tree whose specification findings sit one level down
        const result = await cli
            .fixture(directory('../../__fixtures__/file-suffix-matches-place-placement/'))
            .exec('.');

        // Then - the specification passes report what `specs` reports, anchored on the root that was named
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            specs/api/users/creation.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a \`.test.ts\` under \`specs/api/\`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it \`api/users/creation.spec.ts\`; \`typescript fix\` does it with \`git mv\` · read: docs/reference/linting.md#file-suffix-matches-place
            specs/api/helpers/normalize.test.ts:1:1: error jterrazz-check(specification-test-uses-its-runner): found: a test under the \`api\` specification that reaches no runner · why: A test under \`specs/<specification>/\`, where the specification root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself. · fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test into the \`__tests__/\` of its module's folder · read: docs/reference/linting.md#specification-test-uses-its-runner
            found: every finding above, and .studio/baseline.json records no \`jterrazz-check/\` entry in its \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'typescript baseline' to record where the project stands · read: docs/reference/linting.md#the-ratchet-the-test-section-of-studiobaselinejson
        `);
    });

    test('lint — checker CLI contract — a project checked out under a folder named `specs/` is a project root, not a tree', async () => {
        // Given - a package whose checkout sits under `specs/`, with a finding one level down its own tree
        const result = await cli
            .fixture(directory('./__fixtures__/checker-under-specs/'))
            .exec('specs/checkout');

        // Then - the `specs` above the package is the machine's: the run walks the project's own tree
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            specs/api/users/creation.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a \`.test.ts\` under \`specs/api/\`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it \`api/users/creation.spec.ts\`; \`typescript fix\` does it with \`git mv\` · read: docs/reference/linting.md#file-suffix-matches-place
            found: every finding above, and .studio/baseline.json records no \`jterrazz-check/\` entry in its \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'typescript baseline' to record where the project stands · read: docs/reference/linting.md#the-ratchet-the-test-section-of-studiobaselinejson
        `);
    });

    // invariant: scalpel (\`output-asserted-as-a-golden\`): a golden here would couple the CLI boundary to the diagnostic formatting.
    test('lint — checker CLI contract — a root holding no specs tree at all is refused, not reported clean', async () => {
        // Given - a package with module tests and no `specs/` anywhere below it
        const result = await cli.fixture(directory('./__fixtures__/checker-no-specs/')).exec('.');

        // Then - the run the operator asked for had nothing to walk, and says so
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('no `specs/` tree under');
    });

    // invariant: scalpel (\`output-asserted-as-a-golden\`): a golden here would couple the CLI boundary to the diagnostic formatting.
    test('lint — checker CLI contract — a nonexistent root fails loudly instead of reporting a clean tree', async () => {
        // Given - a target directory that does not exist
        const result = await cli.exec('does-not-exist-xyz');

        // Then - the checker rejects it (exit 1) rather than passing vacuously, and points at the chapter that says where it runs
        expect(result.exitCode).toBe(1);
        expect(result.stdout.text).toContain('no such directory');
        expect(result.stdout.text).toContain('docs/reference/linting.md#the-conventions-checker');
    });

    test('lint — checker CLI contract — a ratchet the project broke fails the run, naming each key and the gesture', async () => {
        // Given - a recorded debt the project paid, and a finding nobody recorded
        const result = await cli.fixture(directory('../__fixtures__/checker-ratchet/')).exec('.');

        // Then - both breaches, and the command that records the new state
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('./__expected__/new-debt-and-a-cleared-entry.txt'));
    });

    test("lint — checker CLI contract — a section still holding a plugin rule names the move to oxlint's own file", async () => {
        // Given - a section recorded when the checker still counted the plugin's rules
        const result = await cli
            .fixture(directory('./__fixtures__/checker-plugin-key-left/'))
            .exec('.');

        // Then - the plugin's key is refused in four parts, naming the two gestures that move it, beside the ratchet's own verdict
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            baseline-ratchet  .studio/baseline.json › test  found: \`jterrazz/test-in-its-tests-folder\` is held in the test section · why: the plugin's rules are oxlint's own, held file by file in .studio/oxlint-suppressions.json: one finding, one judge · fix: run 'typescript baseline' · read: docs/reference/linting.md#the-ratchet-the-test-section-of-studiobaselinejson
        `);
    });

    test('lint — checker CLI contract — the root member run judges the ratchet, and prints the tree finding it fails on', async () => {
        // Given - the broken ratchet, judged by the run typescript check makes
        const result = await cli
            .fixture(directory('../__fixtures__/checker-ratchet/'))
            .exec('--member .');

        // Then - the verdict and its evidence, the same log the path-less run prints
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('./__expected__/new-debt-and-a-cleared-entry.txt'));
    });

    test('lint — checker CLI contract — with no ratchet, the root member run judges and prints only its own findings', async () => {
        // Given - a dead fixture under specs/, no .studio/baseline.json
        const result = await cli
            .fixture(directory('../../__fixtures__/no-unused-ground/'))
            .exec('--member .');

        // Then - the tree finding is the per-root run's: this run neither prints nor fails on it
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toBe('');
    });

    test('lint — checker CLI, the logs a ratchet run prints — a run another run judges prints its findings, names the judge, and exits 0', async () => {
        // Given - one specs tree of a project keeping .studio/baseline.json › test, the tree holding a finding the section does not
        const result = await cli
            .fixture(directory('../__fixtures__/checker-ratchet/'))
            .exec('specs');

        // Then - the finding and the file that judges it, and no verdict of its own
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            conventions checker: 1 finding(s) under {{workdir}}/specs, judged by .studio/baseline.json › test
            widget/__seeds__/dead.sql:1:1: error jterrazz-check(no-unused-ground): found: __seeds__/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced: a folder's by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan. · fix: delete __seeds__/dead.sql, or name it from the test that stands on it · read: docs/reference/linting.md#no-unused-ground
        `);
    });
});
