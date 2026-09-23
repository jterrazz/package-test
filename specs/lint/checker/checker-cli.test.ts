import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { cli } from '../checker.specification.js';

describe('lint — checker CLI contract', () => {
    // Full-output golden: the checker's diagnostics are OUR product, so the
    // D11(d) id-only-grep carve-out (reserved for third-party linters) does not
    // Apply — the whole stream is asserted, tokens covering the run cwd.
    test('a root that is not a specs tree is read as the project holding one', async () => {
        // Given - the project root of a tree whose facet findings sit one level down
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c12-spec-placement/'))
            .exec('.');

        // Then - the facet passes report what `specs` reports, anchored on the root that was named
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(file('./expected/checker-project-root.txt'));
    });

    test('a project checked out under a folder named `specs/` is a project root, not a tree', async () => {
        // Given - a package whose checkout sits under `specs/`, with a finding one level down its own tree
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-under-specs/'))
            .exec('specs/checkout');

        // Then - the `specs` above the package is the machine's: the run walks the project's own tree
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(file('./expected/checker-under-specs.txt'));
    });

    // Scalpel (D11): targeted exit-code + message probe on the CLI boundary — a
    // Full-output golden would couple this to the diagnostic formatting.
    test('a root holding no specs tree at all is refused, not reported clean', async () => {
        // Given - a package with module tests and no `specs/` anywhere below it
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-no-specs/'))
            .exec('.');

        // Then - the run the operator asked for had nothing to walk, and says so
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('no `specs/` tree under');
    });

    // Scalpel (D11): targeted exit-code + message probe on the CLI boundary — a
    // Full-output golden would couple this to the diagnostic formatting.
    test('a nonexistent root fails loudly instead of reporting a clean tree', async () => {
        // Given - a target directory that does not exist
        const result = await cli.exec('does-not-exist-xyz');

        // Then - the checker rejects it (exit 1) rather than passing vacuously
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('no such directory');
    });

    test('`baseline` records the project where it stands, and the next run is held by it', async () => {
        // Given - a project with one dead fixture and no ratchet, recorded then judged
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures/'))
            .exec(['baseline .', '.']);

        // Then - the file holds the one finding, and the run it holds exits 0
        expect(result.exitCode).toBe(0);
        expect(result.file('test.baseline.json').content).toBe(
            '{\n    "jterrazz-check/c9": 1\n}\n',
        );
    });

    test('a green ratchet run prints one line for what the file holds, and not the findings it holds', async () => {
        // Given - a project with one dead fixture, recorded, then judged
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures/'))
            .exec(['baseline .', '.']);

        // Then - the summary alone; the held finding prints only when a verdict fails
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/checker-held.txt'));
        expect(result.stderr.text).toBe('');
    });

    test('a ratchet the project broke fails the run, naming each key and the gesture', async () => {
        // Given - a recorded debt the project paid, and a finding nobody recorded
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-ratchet/'))
            .exec('.');

        // Then - both breaches, and the command that records the new state
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(file('./expected/checker-ratchet.txt'));
    });

    test('the root member run judges the ratchet, and prints the tree finding it fails on', async () => {
        // Given - the broken ratchet, judged by the run typescript check makes
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-ratchet/'))
            .exec('--member .');

        // Then - the verdict and its evidence, the same log the path-less run prints
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(file('./expected/checker-ratchet.txt'));
    });

    test('with no ratchet, the root member run judges and prints only its own findings', async () => {
        // Given - a dead fixture under specs/, no test.baseline.json
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures/'))
            .exec('--member .');

        // Then - the tree finding is the per-root run's: this run neither prints nor fails on it
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toBe('');
    });

    test('the plugin diagnostics are read from the report typescript check hands over', async () => {
        // Given - no oxlint installed, and a report holding one diagnostic of the plugin
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-oxlint-report/'))
            .exec('--oxlint-report oxlint-report.json');

        // Then - the value of the flag is no project root, and the one diagnostic is counted
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(file('./expected/checker-oxlint-report.txt'));
    });

    // Scalpel (D11): targeted exit-code + message probe on the CLI boundary — a
    // Full-output golden would couple this to the diagnostic formatting.
    test('a report path that names no file fails loudly instead of counting nothing', async () => {
        // Given - a report that was never written
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-oxlint-report/'))
            .exec('--oxlint-report missing.json');

        // Then - the checker refuses it rather than judging an empty report
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('no such oxlint report');
    });
});

describe('lint — checker CLI, the logs a ratchet run prints', () => {
    test('a run another run judges prints its findings, names the judge, and exits 0', async () => {
        // Given - one specs tree of a project keeping test.baseline.json, the tree holding a finding the file does not
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-ratchet/'))
            .exec('specs');

        // Then - the finding and the file that judges it, and no verdict of its own
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toMatch(file('./expected/checker-deferred.txt'));
    });

    test('`--format json` prints the findings on a green ratchet run too', async () => {
        // Given - a project whose one finding is recorded, judged with the JSON format
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/c9-dead-fixtures/'))
            .exec(['baseline .', '. --format json']);

        // Then - the record, then the held finding as JSON: the machine format carries the findings whatever the verdict
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(file('./expected/checker-held-json.txt'));
    });

    test("`--format json` carries the checker's own findings, never the plugin's it judges", async () => {
        // Given - a broken ratchet, and a report holding a diagnostic of the plugin and one of another
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-ratchet/'))
            .fixture(
                file('./fixtures/lint-violations/checker-oxlint-report/oxlint-report.json'),
            )
            .exec('. --format json --oxlint-report oxlint-report.json');

        // Then - the verdict fails on both, and the JSON holds the tree's finding alone
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toMatch(file('./expected/checker-failing-json.txt'));
    });

    test('`--summary` cuts a green ratchet run to exactly the held line', async () => {
        // Given - a project whose checker finding and plugin diagnostic are both recorded
        const result = await cli
            .fixture(directory('./fixtures/lint-violations/checker-ratchet/'))
            .fixture(
                file('./fixtures/lint-violations/checker-oxlint-report/oxlint-report.json'),
            )
            .exec([
                'baseline . --oxlint-report oxlint-report.json',
                '--member . --summary --oxlint-report oxlint-report.json',
            ]);

        // Then - one line and nothing after it: what typescript check shows on a green run
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('test.baseline.json: 2 held across 2 rules\n');
        expect(result.stderr.text).toBe('');
    });
});
