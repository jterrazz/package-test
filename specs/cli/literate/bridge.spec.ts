import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { file } from '../../../src/index.js';
import type { DiskFile, RelativePath } from '../../../src/index.js';
import { cli } from '../literate-cli.specification.js';

/**
 * The spec-document format run through the BRIDGE door (`cli.run`). The same
 * documents also run through the plugin door — `vitest.config.ts` collects
 * `specs/cli/literate/*.spec.yaml` as test files — so every scenario here is
 * proven twice, once per entry point, against one engine.
 *
 * The `fixtures/` twins are the deliberately-wrong inputs: a document whose
 * golden or shape is wrong on purpose, kept out of the plugin's glob so the
 * runner never tries to pass them.
 */

function scratchFile(content: string): string {
    const dir = mkdtempSync(resolve(tmpdir(), 'spec-document-'));
    onTestFinished(() => {
        rmSync(dir, { force: true, recursive: true });
    });
    const path = resolve(dir, 'case.spec.yaml');
    writeFileSync(path, content);
    return path;
}

/** A scratch document, named the one way `cli.run()` accepts: `file()`, from this spec. */
function documentAt(path: string): DiskFile<'.spec.yaml'> {
    return file(relative(import.meta.dirname, path) as RelativePath<'.spec.yaml'>);
}

describe('bridge', () => {
    test('runs a bare document and hands back the last run result', async () => {
        // Given - a scenario with no ground to state and one command
        const result = await cli.run(file('./help.spec.yaml'));

        // Then - the document asserted itself; the result is still a CliResult
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Usage: cli <command>');
    });

    test('a two-run sequence shares one working directory', async () => {
        // Given - build writes dist/, start reads it — one cwd, two runs
        const result = await cli.run(file('./built-then-started.spec.yaml'));

        // Then - the document proved the sequence; the cwd is readable afterwards
        expect(result.file('dist/index.js').exists).toBeTruthy();
    });

    test('an env set and an inline pair both reach the child', async () => {
        // Given - `env: [frozen, EXTRA=inline]`
        const result = await cli.run(file('./frozen-env.spec.yaml'));

        // Then - the set's value reached the child, and so did the pair
        expect(result.stdout.text).toContain('MY_VAR=from-the-frozen-set');
    });

    test('a served URL matches through {{url}} whatever port was free', async () => {
        // Given - the echo server started by the document, on an OS-picked port
        const result = await cli.run(file('./served-url.spec.yaml'));

        // Then - the document matched the URL by token; the raw value is a real one
        expect(result.stdout.text).toMatch(/backend http:\/\/127\.0\.0\.1:\d+\//u);
    });

    test('a served stub answers out of the workdir the document laid down', async () => {
        // Given - the stub reads TEST_WORKDIR: run 1 echoes it, run 2 serves the file the document's `fixture:` put there
        const result = await cli.run(file('./served-workdir.spec.yaml'));

        // Then - the answer came off disk, from the very cwd the runs share
        expect(result.file('answers/dashboard/posts.json').content).toContain(
            'the fixture is the answer',
        );
    });

    test("a document's own TEST_WORKDIR wins over the one the runner seeds", async () => {
        // Given - the mapping form sets the key the runner already seeded
        const path = scratchFile(
            [
                'description: states the workdir its stub reads',
                'serve:',
                '  - echo: { TEST_WORKDIR: /elsewhere }',
                'runs:',
                '  - command: backend-fetch workdir',
                '    exit: 0',
                '    stdout: |',
                '      /elsewhere',
                '',
            ].join('\n'),
        );

        // Then - the document's value reached the server, not the temp cwd
        const result = await cli.run(documentAt(path));
        expect(result.stdout.text).toBe('/elsewhere\n');
    });

    test('`|` and `|-` are compared byte for byte, final newline included', async () => {
        // Given - two runs, one output ending on a newline and one not
        const result = await cli.run(file('./chomping.spec.yaml'));

        // Then - the last run's raw stdout carries no trailing newline at all
        expect(result.stdout.text).toBe('ends here');
    });

    test('stdin: is written to the child, then closed', async () => {
        // Given - a command that reads its input to EOF and shouts it back
        const result = await cli.run(file('./piped-input.spec.yaml'));

        // Then - the document's own golden already proved it; the result agrees
        expect(result.stdout.text).toContain('SHOUT THIS');
    });

    test('files: asserts what the run left on disk', async () => {
        // Given - contains, equals, exists and absent over one scaffold
        const result = await cli.run(file('./written-files.spec.yaml'));

        // Then - the document passed, and the tree it judged is the result's cwd
        expect(result.file('out/go.mod').content).toBe('module example\n');
    });

    test('an absent: holds against the cwd of ITS run, not of the last one', async () => {
        // Given - run 1 states dist/index.js is not there yet, run 2 builds it
        const result = await cli.run(file('./absent-then-written.spec.yaml'));

        // Then - the absent passed although the session ends with the file there
        expect(result.file('dist/index.js').exists).toBeTruthy();
    });

    test('an exists: holds against the cwd of ITS run, not of the last one', async () => {
        // Given - run 1 builds dist/index.js, run 2 removes it again
        const result = await cli.run(file('./written-then-removed.spec.yaml'));

        // Then - the exists passed although the session ends with the file gone
        expect(result.file('dist/index.js').exists).toBeFalsy();
    });
});
