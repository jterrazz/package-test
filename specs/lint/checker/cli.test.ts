import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('cli', () => {
    // The checker's diagnostics are this package's product, so the whole stream is goldened.
    test('lint — checker CLI contract — a root that is not a specs tree is read as the project holding one', async () => {
        // Given - the project root of a tree whose facet findings sit one level down
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/file-suffix-matches-place-placement/'))
            .exec('.');

        // Then - the facet passes report what `specs` reports, anchored on the root that was named
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/api/users/creation.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a \`.test.ts\` under \`specs/api/\`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it \`api/users/creation.spec.ts\` — \`make fix\` does it with \`git mv\` · read: docs/19-linting.md#file-suffix-matches-place
            specs/api/helpers/normalize.test.ts:1:1: error jterrazz-check(facet-test-uses-its-runner): found: a test under the \`api\` facet that reaches no runner · why: A test under \`specs/<facet>/\`, where the facet root holds a \`*.specification.ts(x)\`, imports that module or constructs a runner itself. · fix: import \`{ api }\` from \`api.specification.js\` and drive the product through it, or move the module test beside its module · read: docs/19-linting.md#facet-test-uses-its-runner

            conventions checker: 2 error(s) found under {{workdir}}
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('lint — checker CLI contract — a project checked out under a folder named `specs/` is a project root, not a tree', async () => {
        // Given - a package whose checkout sits under `specs/`, with a finding one level down its own tree
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-under-specs/'))
            .exec('specs/checkout');

        // Then - the `specs` above the package is the machine's: the run walks the project's own tree
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/api/users/creation.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a \`.test.ts\` under \`specs/api/\`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it \`api/users/creation.spec.ts\` — \`make fix\` does it with \`git mv\` · read: docs/19-linting.md#file-suffix-matches-place

            conventions checker: 1 error(s) found under {{workdir}}/specs/checkout
            found: every finding above, and jterrazz.baseline.json keeps no \`test\` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'jterrazz-test-check baseline' to record where the project stands · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    // Scalpel (\`output-asserted-as-a-golden\`): a golden here would couple the CLI boundary to the diagnostic formatting.
    test('lint — checker CLI contract — a root holding no specs tree at all is refused, not reported clean', async () => {
        // Given - a package with module tests and no `specs/` anywhere below it
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-no-specs/'))
            .exec('.');

        // Then - the run the operator asked for had nothing to walk, and says so
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('no `specs/` tree under');
    });

    // Scalpel (\`output-asserted-as-a-golden\`): a golden here would couple the CLI boundary to the diagnostic formatting.
    test('lint — checker CLI contract — a nonexistent root fails loudly instead of reporting a clean tree', async () => {
        // Given - a target directory that does not exist
        const result = await cli.exec('does-not-exist-xyz');

        // Then - the checker rejects it (exit 1) rather than passing vacuously
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('no such directory');
    });

    test('lint — checker CLI contract — `baseline` records the project where it stands, and the next run is held by it', async () => {
        // Given - a project with one dead fixture and no ratchet, recorded then judged
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unused-ground/'))
            .exec(['baseline .', '.']);

        // Then - the family file holds the test section and its one finding, and the run it holds exits 0
        expect(result.exitCode).toBe(0);
        expect(result.file('jterrazz.baseline.json').content).toBe(
            '{\n    "test": {\n        "jterrazz-check/no-unused-ground": 1\n    }\n}\n',
        );
    });

    test('lint — checker CLI contract — `baseline` rewrites the test section and keeps the typescript section byte for byte', async () => {
        // Given - a family file holding both sections, the typescript one spelled on one line
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .exec('baseline .');

        // Then - the recorded debt is the tree's, and the other package's section is untouched
        expect(result.exitCode).toBe(0);
        expect(result.file('jterrazz.baseline.json').content).toBe(
            '{\n    "typescript": { "eslint/complexity": 3 },\n    "test": {\n        "jterrazz-check/no-unused-ground": 1\n    }\n}\n',
        );
    });

    test('lint — checker CLI contract — a green ratchet run prints exactly the held line, and not the findings it holds', async () => {
        // Given - a project with one dead fixture, recorded, then judged
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unused-ground/'))
            .exec(['baseline .', '.']);

        // Then - the summary alone; the held finding prints only when a verdict fails
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: 1 held across 1 rule\n');
        expect(result.stderr.text).toBe('');
    });

    test('lint — checker CLI contract — a green `--fix` run prints exactly the held line', async () => {
        // Given - a project with one dead fixture, recorded, then fixed
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unused-ground/'))
            .exec(['baseline .', '. --fix']);

        // Then - the same one line the check prints: nothing to rewrite, nothing more to say
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: 1 held across 1 rule\n');
        expect(result.stderr.text).toBe('');
    });

    test('lint — checker CLI contract — `--verbose` adds to the held line where the run stood and what ran', async () => {
        // Given - a project with one dead fixture, recorded, then judged verbosely
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unused-ground/'))
            .exec(['baseline .', '. --verbose']);

        // Then - the held line, then the project root and every pass
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            jterrazz.baseline.json › test: 1 held across 1 rule — conventions checker under {{workdir}} (reserved-folder-in-closed-list, spec-code-in-setup-folder, setup-module-at-lowest-common-folder, adapter-named-for-its-port, database-named-only-when-several, docker-exec-bound-with-await-using, file-suffix-matches-place, no-reach-into-sibling-ground, no-document-in-ground, facet-test-uses-its-runner, facet-folder-has-specification, ground-beside-its-only-reader, seeds-state-absolute-time, no-duplicate-ground, ground-shared-or-inline, one-subject-per-spec, spec-in-subject-folder, named-path-exists, document-env-and-serve-registered, no-unused-ground, no-token-in-request, no-silent-refusal, no-malformed-ref, no-unknown-token, http-first-line-follows-its-grammar, document-follows-its-grammar, no-volatile-literal, pinned-value-from-the-input, no-empty-expected-stream, document-description-unique, checker-suppression-states-a-reason, document-description-reads-as-a-title, no-snapshot-folder, member-has-vitest-config, no-simulated-dom-in-config, no-redundant-test-dependency)
        `);
        expect(result.stderr.text).toBe('');
    });

    test('lint — checker CLI contract — a ratchet the project broke fails the run, naming each key and the gesture', async () => {
        // Given - a recorded debt the project paid, and a finding nobody recorded
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .exec('.');

        // Then - both breaches, and the command that records the new state
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(file('./_expected/new-debt-and-a-cleared-entry.txt'));
    });

    test("lint — checker CLI contract — a section still holding a plugin rule names the move to oxlint's own file", async () => {
        // Given - a section recorded when the checker still counted the plugin's rules
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-plugin-key-left/'))
            .exec('.');

        // Then - the plugin's key is refused in four parts, naming the two gestures that move it, beside the ratchet's own verdict
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/_seeds/dead.sql:1:1: error jterrazz-check(no-unused-ground): found: _seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan. · fix: delete _seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#no-unused-ground
            baseline-ratchet  jterrazz.baseline.json › test  found: \`jterrazz/test-beside-its-module\` is held in the test section · why: the plugin's rules are oxlint's own, held file by file in oxlint-suppressions.json — one finding, one judge · fix: run 'typescript baseline', then 'jterrazz-test-check baseline' · read: docs/19-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson
        `);
    });

    test('lint — checker CLI contract — the root member run judges the ratchet, and prints the tree finding it fails on', async () => {
        // Given - the broken ratchet, judged by the run typescript check makes
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .exec('--member .');

        // Then - the verdict and its evidence, the same log the path-less run prints
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(file('./_expected/new-debt-and-a-cleared-entry.txt'));
    });

    test('lint — checker CLI contract — with no ratchet, the root member run judges and prints only its own findings', async () => {
        // Given - a dead fixture under specs/, no jterrazz.baseline.json
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unused-ground/'))
            .exec('--member .');

        // Then - the tree finding is the per-root run's: this run neither prints nor fails on it
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toBe('');
    });

    test('lint — checker CLI, the logs a ratchet run prints — a run another run judges prints its findings, names the judge, and exits 0', async () => {
        // Given - one specs tree of a project keeping jterrazz.baseline.json › test, the tree holding a finding the section does not
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .exec('specs');

        // Then - the finding and the file that judges it, and no verdict of its own
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            widget/_seeds/dead.sql:1:1: error jterrazz-check(no-unused-ground): found: _seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan. · fix: delete _seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#no-unused-ground
            conventions checker: 1 finding(s) under {{workdir}}/specs, judged by jterrazz.baseline.json › test
        `);
    });

    test('lint — checker CLI, the logs a ratchet run prints — `--format json` prints the findings on a green ratchet run too', async () => {
        // Given - a project whose one finding is recorded, judged with the JSON format
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/no-unused-ground/'))
            .exec(['baseline .', '. --format json']);

        // Then - the record, then the held finding as JSON: the machine format carries the findings whatever the verdict
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            [{"code":"jterrazz-check(no-unused-ground)","file":"specs/widget/_seeds/dead.sql","line":1,"message":"found: _seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a folder's, by the tests at or below it, and the specs root's shared four under \`<specs>/_shared/\`; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan. · fix: delete _seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#no-unused-ground"}]
        `);
    });

    test('lint — checker CLI, the logs a ratchet run prints — a green root member run prints exactly the held line', async () => {
        // Given - a project whose checker finding is recorded
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .exec(['baseline .', '--member .']);

        // Then - one line and nothing after it: what typescript check shows on a green run
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: 1 held across 1 rule\n');
        expect(result.stderr.text).toBe('');
    });
});
