import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker-cli.specification.js';

describe('cli', () => {
    test('lint — checker CLI contract — `baseline` records the project where it stands, and the next run is held by it', async () => {
        // Given - a project with one dead fixture and no ratchet, recorded then judged
        const result = await cli
            .fixture(directory('../../__fixtures__/no-unused-ground/'))
            .exec(['baseline .', '.']);

        // Then - the family file holds the test section and its one finding, and the run it holds exits 0
        expect(result.exitCode).toBe(0);
        expect(result.file('.jterrazz/baseline.json').content).toBe(
            '{\n    "test": {\n        "jterrazz-check/no-unused-ground": 1\n    }\n}\n',
        );
    });

    test('lint — checker CLI contract — a green ratchet run prints exactly the held line, and not the findings it holds', async () => {
        // Given - a project with one dead fixture, recorded, then judged
        const result = await cli
            .fixture(directory('../../__fixtures__/no-unused-ground/'))
            .exec(['baseline .', '.']);

        // Then - the summary alone; the held finding prints only when a verdict fails
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('.jterrazz/baseline.json › test: 1 held across 1 rule\n');
        expect(result.stderr.text).toBe('');
    });

    test('lint — checker CLI contract — a green `--fix` run prints exactly the held line', async () => {
        // Given - a project with one dead fixture, recorded, then fixed
        const result = await cli
            .fixture(directory('../../__fixtures__/no-unused-ground/'))
            .exec(['baseline .', '. --fix']);

        // Then - the same one line the check prints: nothing to rewrite, nothing more to say
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('.jterrazz/baseline.json › test: 1 held across 1 rule\n');
        expect(result.stderr.text).toBe('');
    });

    test('lint — checker CLI contract — `--verbose` adds to the held line where the run stood and what ran', async () => {
        // Given - a project with one dead fixture, recorded, then judged verbosely
        const result = await cli
            .fixture(directory('../../__fixtures__/no-unused-ground/'))
            .exec(['baseline .', '. --verbose']);

        // Then - the held line, then the project root and every pass
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            conventions checker under {{workdir}} (reserved-folder-in-closed-list, spec-code-in-setup-folder, setup-module-at-lowest-common-folder, adapter-named-for-its-port, database-named-only-when-several, docker-exec-bound-with-await-using, file-suffix-matches-place, no-reach-into-sibling-ground, no-document-in-ground, specification-test-uses-its-runner, specification-folder-has-its-runner, ground-beside-its-only-reader, seeds-state-absolute-time, no-duplicate-ground, ground-shared-or-inline, one-subject-per-spec, spec-in-subject-folder, named-path-exists, document-env-and-serve-registered, no-unused-ground, no-token-in-request, no-silent-refusal, no-malformed-ref, no-unknown-token, http-first-line-follows-its-grammar, document-follows-its-grammar, no-volatile-literal, pinned-value-from-the-input, no-empty-expected-stream, document-description-unique, checker-suppression-states-a-reason, checker-suppression-names-a-pass, document-description-reads-as-a-title, no-snapshot-folder, no-simulated-dom-in-config, no-redundant-test-dependency)
            .jterrazz/baseline.json › test: 1 held across 1 rule
        `);
        expect(result.stderr.text).toBe('');
    });

    test('lint — checker CLI, the logs a ratchet run prints — `--format json` prints the findings on a green ratchet run too', async () => {
        // Given - a project whose one finding is recorded, judged with the JSON format
        const result = await cli
            .fixture(directory('../../__fixtures__/no-unused-ground/'))
            .exec(['baseline .', '. --format json']);

        // Then - the record, then the held finding as JSON: the machine format carries the findings whatever the verdict
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            [{"column":1,"line":1,"message":"found: __seeds__/dead.sql, which no test of widget names · why: No dead fixtures: every file under \`__seeds__/\`/\`__requests__/\`/\`__fixtures__/\` and every top-level entry of \`__expected__/\` must be referenced: a folder's by the tests at or below it, the specs root's shared four by any test of the tree; a folder holding ground with no test file and no \`*.spec.yaml\` at or below it is an orphan. · fix: delete __seeds__/dead.sql, or name it from the test that stands on it · read: docs/reference/linting.md#no-unused-ground","path":"specs/widget/__seeds__/dead.sql","rule":"jterrazz-check/no-unused-ground"}]
        `);
    });

    test('lint — checker CLI, the logs a ratchet run prints — a green root member run prints exactly the held line', async () => {
        // Given - a project whose checker finding is recorded
        const result = await cli
            .fixture(directory('../__fixtures__/checker-ratchet/'))
            .exec(['baseline .', '--member .']);

        // Then - one line and nothing after it: what typescript check shows on a green run
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('.jterrazz/baseline.json › test: 1 held across 1 rule\n');
        expect(result.stderr.text).toBe('');
    });
});
