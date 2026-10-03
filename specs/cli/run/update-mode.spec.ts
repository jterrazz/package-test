import { file } from '@jterrazz/test';
import type { DiskFile, RelativePath } from '@jterrazz/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

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

const isRelativeDocument = (path: string): path is RelativePath<'.spec.yaml'> =>
    (path.startsWith('./') || path.startsWith('../')) && path.endsWith('.spec.yaml');

function documentAt(path: string): DiskFile<'.spec.yaml'> {
    const from = relative(import.meta.dirname, path);
    if (!isRelativeDocument(from)) {
        throw new Error(`${path} is no document a spec can name by a relative path`);
    }
    return file(from);
}

async function failureOf(run: Promise<unknown>): Promise<string> {
    const error = await errorOf(run);
    return error.message;
}

async function errorOf(run: Promise<unknown>): Promise<Error> {
    try {
        await run;
    } catch (error) {
        if (error instanceof Error) {
            return error;
        }
        throw error;
    }
    throw new Error('expected the spec document to fail, but it passed');
}

describe('update-mode', () => {
    test('rewrites exit and streams, keeping comments, key order and files:', async () => {
        // Given - a document whose golden is stale in both streams
        const path = scratchFile(
            [
                '# a comment the rewrite must keep',
                'description: rewrites what each run produced',
                'runs:',
                '  - command: fail',
                '    exit: 0',
                '    stdout: |',
                '      stale stdout',
                '',
            ].join('\n'),
        );

        // Given - one update run
        vi.stubEnv('TEST_UPDATE', '1');
        try {
            await cli.run(documentAt(path));
        } finally {
            vi.unstubAllEnvs();
        }

        // Then - the comment and the description survived; the runs hold the truth
        const written = readFileSync(path, 'utf8');
        expect(written).toContain('# a comment the rewrite must keep');
        expect(written).toContain('description: rewrites what each run produced');
        expect(written).toContain('exit: 2');
        expect(written).toContain(
            'stderr: |\n      Starting...\n      Fatal: something went wrong',
        );
        expect(written).not.toContain('stdout');

        // Then - the rewritten document passes on a normal run
        await cli.run(documentAt(path));
    });

    test('{{url}} survives a port change: the second server gets another port', async () => {
        // Given - a golden already tokenised, updated against a fresh server
        const source = [
            'description: keeps the url token across runs',
            'serve: echo',
            'runs:',
            '  - command: backend',
            '    exit: 0',
            '    stdout: |',
            '      backend {{url}}',
            '',
        ].join('\n');
        const path = scratchFile(source);

        // Given - two update runs, each with its own server and port
        vi.stubEnv('TEST_UPDATE', '1');
        try {
            await cli.run(documentAt(path));
            const first = readFileSync(path, 'utf8');
            await cli.run(documentAt(path));

            // Then - the token was never replaced by a run-specific URL
            expect(first).toContain('backend {{url}}');
            expect(readFileSync(path, 'utf8')).toBe(source);
        } finally {
            vi.unstubAllEnvs();
        }
    });

    test('a mid-file insertion keeps the tokens of the lines it shifted', async () => {
        // Given - a golden whose token line sits above the line a new command adds; the update must recognise it where it landed, not by index
        const path = scratchFile(
            [
                'description: survives a new line appearing above a token',
                'runs:',
                '  - command: version',
                '    exit: 0',
                '    stdout: |',
                '      cli-app v{{semver}}',
                '      cwd {{workdir}}',
                '',
            ].join('\n'),
        );

        // Given - one update run against output carrying two EXTRA lines
        vi.stubEnv('TEST_UPDATE', '1');
        try {
            await cli.run(documentAt(path));
        } finally {
            vi.unstubAllEnvs();
        }

        // Then - both tokens survived the shift, and nothing was pinned
        const written = readFileSync(path, 'utf8');
        expect(written).toContain('cli-app v{{semver}}');
        expect(written).toContain('cwd {{workdir}}');
        expect(written).not.toContain('cwd /');
    });

    test('files:, the command and the run order are never rewritten', async () => {
        // Given - a document whose files: assertion is deliberately wrong
        const path = scratchFile(
            [
                'description: leaves everything but the streams alone',
                'runs:',
                '  - command: scaffold',
                '    exit: 0',
                '    files:',
                '      out/main.go: { contains: package rust }',
                '',
            ].join('\n'),
        );

        // Given - one update run
        vi.stubEnv('TEST_UPDATE', '1');
        try {
            await cli.run(documentAt(path));
        } finally {
            vi.unstubAllEnvs();
        }

        // Then - the wrong assertion is still there: an update refreshes the streams and the exit code, and nothing a human decided
        expect(readFileSync(path, 'utf8')).toContain('out/main.go: { contains: package rust }');
    });

    test('an update that changes nothing gives the file back byte for byte', async () => {
        // Given - a true golden, spelled the way the repository formatter spells it: a padded flow mapping, an unpadded flow sequence, one broken over lines, and a comment
        const source = [
            '# the ground of the case',
            'description: rewrites nothing when nothing moved',
            'runs:',
            '    - command: scaffold',
            '      exit: 0',
            '      stdout: |',
            '          Scaffolded',
            '      files:',
            "          out/main.go: { contains: 'package main' }",
            "          out/docs/README.md: { contains: ['# Docs'] }",
            '          out/go.mod:',
            '              {',
            "                  contains: ['module example'],",
            '              }',
            '',
        ].join('\n');
        const path = scratchFile(source);

        // Given - one update run
        vi.stubEnv('TEST_UPDATE', '1');
        try {
            await cli.run(documentAt(path));
        } finally {
            vi.unstubAllEnvs();
        }

        // Then - not one byte moved: a rewrite restates the streams, and a collection it never read is not the writer's to restyle
        expect(readFileSync(path, 'utf8')).toBe(source);
    });

    test('a frozen document is never rewritten under TEST_UPDATE', async () => {
        // Given - a deliberately-wrong golden, run in update mode
        const target = resolve(import.meta.dirname, '_fixtures/wrong-stdout.spec.yaml');
        const before = readFileSync(target, 'utf8');
        vi.stubEnv('TEST_UPDATE', '1');
        let message: string;
        try {
            message = await failureOf(
                cli.run(file('./_fixtures/wrong-stdout.spec.yaml'), { frozen: true }),
            );
        } finally {
            vi.unstubAllEnvs();
        }

        // Then - it still threw its diff, and the file on disk is untouched
        expect(message).toContain('found: spec mismatch — ');
        expect(readFileSync(target, 'utf8')).toBe(before);
    });
});
