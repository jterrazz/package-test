import { file, text } from '@jterrazz/test';
import type { DiskFile, RelativePath } from '@jterrazz/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { cli } from '../literate-cli.specification.js';

/** Every scenario runs through both doors, the plugin and `cli.run`; the `_fixtures/` twins are deliberately wrong and kept out of the plugin's glob. */

function scratchFile(content: string): string {
    const dir = mkdtempSync(resolve(tmpdir(), 'spec-document-'));
    onTestFinished(() => {
        rmSync(dir, { force: true, recursive: true });
    });
    const path = resolve(dir, 'case.spec.yaml');
    writeFileSync(path, content);
    return path;
}

function documentAt(path: string): DiskFile<'.spec.yaml'> {
    return file(relative(import.meta.dirname, path) as RelativePath<'.spec.yaml'>);
}

async function failureOf(run: Promise<unknown>): Promise<string> {
    const error = await errorOf(run);
    return error.message;
}

async function errorOf(run: Promise<unknown>): Promise<Error> {
    try {
        await run;
    } catch (error) {
        return error as Error;
    }
    throw new Error('expected the spec document to fail, but it passed');
}

function frames(error: Error): string[] {
    return (error.stack ?? '')
        .split('\n')
        .filter((line) => line.trimStart().startsWith('at '))
        .map((line) => line.trim());
}

describe('refusals', () => {
    test('a key outside the closed set names the key, the line and the vocabulary', async () => {
        // Given - a `when:` line
        const message = await failureOf(cli.run(file('./_fixtures/unknown-key.spec.yaml')));

        // Then - the closed vocabulary is spelled out in the refusal
        expect(message).toContain('unknown key "when:"');
        expect(message).toContain('description, fixture, env, serve, runs');
        expect(message).toContain('unknown-key.spec.yaml:2');
    });

    test('a wrong stdout renders the description, the command and a line diff', async () => {
        // Given - a golden nobody updated (frozen: its mismatch IS the subject)
        const message = await failureOf(
            cli.run(file('./_fixtures/wrong-stdout.spec.yaml'), { frozen: true }),
        );

        // Then - the whole rendering, tokens covering the path and the run cwd
        expect(text(message)).toMatch(`
            found: spec mismatch — a run whose golden stdout is deliberately wrong

            $ help

            Output mismatch (stdout)

            - Expected
            + Received

              Usage: cli <command>
              
              Commands:
                build   Build the project
            -   lint    A command this binary does not have
            +   check   Check code quality
              

            specs/cli/run/_fixtures/wrong-stdout.spec.yaml:3
            why: A spec document states what its runs produce: the exit code and the streams, whole.
            fix: correct the command, or run with TEST_UPDATE=1 to rewrite the runs — the exit code and the streams, and nothing else
            read: docs/20-documents.md#failure-and-update`);
    });

    test('a wrong exit code names both codes and what stderr carried', async () => {
        // Given - a golden claiming a failing command succeeds
        const message = await failureOf(
            cli.run(file('./_fixtures/wrong-exit.spec.yaml'), { frozen: true }),
        );

        // Then - the whole rendering, stderr included
        expect(text(message)).toMatch(`
            found: spec mismatch — a run whose golden exit code is deliberately wrong

            $ fail

            exit code mismatch
              expected: 0
              received: 2

            stderr was:
            Starting...
            Fatal: something went wrong

            specs/cli/run/_fixtures/wrong-exit.spec.yaml:3
            why: A spec document states what its runs produce: the exit code and the streams, whole.
            fix: correct the command, or run with TEST_UPDATE=1 to rewrite the runs — the exit code and the streams, and nothing else
            read: docs/20-documents.md#failure-and-update`);
    });

    test('failing files: assertions render as path, expected and got', async () => {
        // Given - a contains that does not, an absent that is there, and a missing file that should exist
        const message = await failureOf(
            cli.run(file('./_fixtures/wrong-files.spec.yaml'), { frozen: true }),
        );

        // Then - the whole rendering, one line per rejected assertion
        expect(text(message)).toMatch(`
            found: spec mismatch — a run whose files assertions are deliberately wrong

            $ scaffold

            files mismatch

              out/main.go: expected to contain "package rust", got "package main\\n"
              out/go.mod: expected absent, got a file
              out/nothing.txt: expected to exist, got nothing at that path

            specs/cli/run/_fixtures/wrong-files.spec.yaml:3
            why: A spec document states what its runs produce: the exit code and the streams, whole.
            fix: correct the command, or run with TEST_UPDATE=1 to rewrite the runs — the exit code and the streams, and nothing else
            read: docs/20-documents.md#failure-and-update`);
    });

    test('the stack carries ONE frame, on the run that failed', async () => {
        // Given - a golden whose run is deliberately wrong
        const error = await errorOf(
            cli.run(file('./_fixtures/wrong-stdout.spec.yaml'), { frozen: true }),
        );

        // Then - no runner frames, no generated-module frame: the `command:` line, which is what the message names too
        expect(frames(error)).toStrictEqual([
            `at ${resolve(import.meta.dirname, '_fixtures/wrong-stdout.spec.yaml')}:3:1`,
        ]);
        expect(error.message).toContain('_fixtures/wrong-stdout.spec.yaml:3');
    });

    test('a grammar refusal points at the offending line, not at the runner', async () => {
        // Given - a document carrying a key outside the closed set (line 2)
        const error = await errorOf(cli.run(file('./_fixtures/unknown-key.spec.yaml')));

        // Then - a refusal naming the line and the key, whose frame is that line, not a parser frame
        expect(error.message).toBe(
            [
                'found: specs/cli/run/_fixtures/unknown-key.spec.yaml:2: unknown key "when:" in a spec document — known keys: description, fixture, env, serve, runs',
                'why: A spec document follows one grammar, read by the parser the runner and the linter share: closed keys, `description:` and `runs:` required, `command:` and `exit:` in every run.',
                'fix: write the key the grammar names; the reason prints the accepted set',
                'read: docs/19-linting.md#document-follows-its-grammar',
            ].join('\n'),
        );
        expect(frames(error)).toStrictEqual([
            `at ${resolve(import.meta.dirname, '_fixtures/unknown-key.spec.yaml')}:2:1`,
        ]);
    });

    test('a matched token line is not marked as a difference beside the real one', async () => {
        // Given - a run whose {{url}} matched and whose next line did not
        const path = scratchFile(
            [
                'description: renders only the real cause',
                'serve: echo',
                'runs:',
                '  - command: backend',
                '    exit: 0',
                '    stdout: |',
                '      backend {{url}}',
                '      not printed at all',
                '',
            ].join('\n'),
        );

        // Then - the token line is shown as equal, with its token
        const message = await failureOf(cli.run(documentAt(path)));
        expect(message).toContain('  backend {{url}}');
        expect(message).not.toContain('- backend {{url}}');
        expect(message).toContain('- not printed at all');
    });

    test('an unregistered server name lists what the runner declares', async () => {
        // Given - a document naming a server nobody registered
        const path = scratchFile(
            `description: names a server that does not exist\nserve: ghost\nruns:\n  - command: help\n    exit: 0\n`,
        );

        const document = documentAt(path);

        // Then - the refusal lists what specification.cli() actually declares
        await expect(failureOf(cli.run(document))).resolves.toContain(
            'fix: serve a registered server: echo',
        );
    });
});
