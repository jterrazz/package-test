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
            jterrazz.baseline.json › test: 1 held across 1 rule — conventions checker under {{workdir}} (database-named-only-when-several, docker-exec-bound-with-await-using, file-suffix-matches-place, no-reach-into-sibling-ground, no-document-in-ground, facet-test-uses-its-runner, facet-folder-has-specification, ground-beside-its-only-reader, seeds-state-absolute-time, no-duplicate-ground, ground-shared-or-inline, one-subject-per-spec, spec-in-subject-folder, named-path-exists, document-env-and-serve-registered, no-unused-ground, no-token-in-request, no-silent-refusal, no-malformed-ref, no-unknown-token, http-first-line-follows-its-grammar, document-streams-written-as-block-scalars, document-keys-in-canonical-order, document-follows-its-grammar, no-volatile-literal, pinned-value-from-the-input, no-empty-expected-stream, document-description-unique, checker-suppression-states-a-reason, document-description-reads-as-a-title, no-snapshot-folder, member-has-vitest-config, no-simulated-dom-in-config, no-redundant-test-dependency)
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

    test("lint — checker CLI contract — a broken ratchet prints its own findings, and counts the plugin's in one line", async () => {
        // Given - the broken ratchet, and a report holding a diagnostic of the plugin and one of another
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .fixture(file('./_fixtures/lint-violations/checker-oxlint-report/oxlint-report.json'))
            .exec('. --oxlint-report oxlint-report.json');

        // Then - the tree's finding in full, the plugin's counted: oxlint's own pass is the one that prints it
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            specs/widget/_seeds/dead.sql:1:1: error jterrazz-check(no-unused-ground): found: _seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/_shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete _seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#no-unused-ground
            conventions checker: 1 plugin diagnostic(s) judged, printed by oxlint's own pass
            baseline-ratchet  jterrazz.baseline.json › test  jterrazz-check/no-unused-ground has 1 finding(s) and no entry — it is new debt
            baseline-ratchet  jterrazz.baseline.json › test  jterrazz/test-beside-its-module has 1 finding(s) and no entry — it is new debt
            baseline-ratchet  jterrazz.baseline.json › test  jterrazz-check/ground-shared-or-inline is at zero — the ratchet moved, delete its entry
            Run 'jterrazz-test-check baseline' to record where the project stands.
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

    test('lint — checker CLI contract — the plugin diagnostics are read from the report typescript check hands over', async () => {
        // Given - no oxlint installed, and a report holding one diagnostic of the plugin
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-oxlint-report/'))
            .exec('--oxlint-report oxlint-report.json');

        // Then - the value of the flag is no project root, and the one diagnostic is counted, not printed again
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            conventions checker: 1 plugin diagnostic(s) judged, printed by oxlint's own pass
            jterrazz/test-beside-its-module  1 diagnostic(s), and the project keeps no jterrazz.baseline.json › test
            Fix them, or run 'jterrazz-test-check baseline' to record where the project stands.
        `);
    });

    test('lint — checker CLI contract — a checker that ran oxlint itself prints the plugin diagnostics it saw', async () => {
        // Given - no report handed in, and a project oxlint reporting one diagnostic of the plugin
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-oxlint-run/'))
            .exec('.');

        // Then - the checker is the one printer of the diagnostic, in full, and counts it nowhere else
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(`
            src/orphan.test.ts:1:1: error jterrazz(test-beside-its-module): a module test has a sibling module
            jterrazz/test-beside-its-module  1 diagnostic(s), and the project keeps no jterrazz.baseline.json › test
            Fix them, or run 'jterrazz-test-check baseline' to record where the project stands.
        `);
    });

    // Scalpel (\`output-asserted-as-a-golden\`): a golden here would couple the CLI boundary to the diagnostic formatting.
    test('lint — checker CLI contract — a report path that names no file fails loudly instead of counting nothing', async () => {
        // Given - a report that was never written
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-oxlint-report/'))
            .exec('--oxlint-report missing.json');

        // Then - the checker refuses it rather than judging an empty report
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('no such oxlint report');
    });

    test('lint — checker CLI, the logs a ratchet run prints — a run another run judges prints its findings, names the judge, and exits 0', async () => {
        // Given - one specs tree of a project keeping jterrazz.baseline.json › test, the tree holding a finding the section does not
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .exec('specs');

        // Then - the finding and the file that judges it, and no verdict of its own
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(`
            widget/_seeds/dead.sql:1:1: error jterrazz-check(no-unused-ground): found: _seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/_shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete _seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#no-unused-ground
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
            [{"code":"jterrazz-check(no-unused-ground)","file":"specs/widget/_seeds/dead.sql","line":1,"message":"found: _seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/_shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete _seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#no-unused-ground","severity":"error"}]
        `);
    });

    test("lint — checker CLI, the logs a ratchet run prints — `--format json` carries the checker's own findings, never the plugin's it judges", async () => {
        // Given - a broken ratchet, and a report holding a diagnostic of the plugin and one of another
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .fixture(file('./_fixtures/lint-violations/checker-oxlint-report/oxlint-report.json'))
            .exec('. --format json --oxlint-report oxlint-report.json');

        // Then - the verdict fails on both, and the JSON holds the tree's finding alone
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(`
            [{"code":"jterrazz-check(no-unused-ground)","file":"specs/widget/_seeds/dead.sql","line":1,"message":"found: _seeds/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`_seeds/\`/\`_requests/\`/\`_fixtures/\` and every top-level entry of \`_expected/\` must be referenced — a leaf's, and the specs root's shared four under \`<specs>/_shared/\`; a feature directory with no test file and no \`*.spec.yaml\` is an orphan (a warning when the argument is not a literal). · fix: delete _seeds/dead.sql, or name it from the test that stands on it · read: docs/19-linting.md#no-unused-ground","severity":"error"}]
        `);
    });

    test('lint — checker CLI, the logs a ratchet run prints — a green root member run prints exactly the held line', async () => {
        // Given - a project whose checker finding and plugin diagnostic are both recorded
        const result = await cli
            .fixture(directory('./_fixtures/lint-violations/checker-ratchet/'))
            .fixture(file('./_fixtures/lint-violations/checker-oxlint-report/oxlint-report.json'))
            .exec([
                'baseline . --oxlint-report oxlint-report.json',
                '--member . --oxlint-report oxlint-report.json',
            ]);

        // Then - one line and nothing after it: what typescript check shows on a green run
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('jterrazz.baseline.json › test: 2 held across 2 rules\n');
        expect(result.stderr.text).toBe('');
    });
});
