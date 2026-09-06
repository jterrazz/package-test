import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { text } from '../../../src/index.js';
import { cli } from '../literate-cli.specification.js';

/**
 * The literate format run through the BRIDGE door (`cli.run`). The same files
 * also run through the plugin door — `vitest.config.ts` collects
 * `specs/cli/literate/*.cli` as test files — so every scenario here is proven
 * twice, once per entry point, against one engine.
 *
 * The `fixtures/` twins are the deliberately-broken inputs: a `.cli` whose
 * header or golden is wrong on purpose, kept out of the plugin's glob so the
 * runner never tries to pass them.
 */

const scratch: string[] = [];

function scratchFile(content: string): string {
    const dir = mkdtempSync(resolve(tmpdir(), 'literate-spec-'));
    scratch.push(dir);
    const path = resolve(dir, 'case.cli');
    writeFileSync(path, content);
    return path;
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
    throw new Error('expected the literate spec to fail, but it passed');
}

/** The `at …` frames of an error's stack, trimmed. */
function frames(error: Error): string[] {
    return (error.stack ?? '')
        .split('\n')
        .filter((line) => line.trimStart().startsWith('at '))
        .map((line) => line.trim());
}

afterEach(() => {
    for (const dir of scratch.splice(0)) {
        rmSync(dir, { force: true, recursive: true });
    }
});

describe('literate — the bridge door (cli.run)', () => {
    test('runs a pure file and hands back the last block result', async () => {
        // Given - a scenario with no ground to state and one command
        const result = await cli.run('help.cli');

        // Then - the file asserted itself; the result is still a CliResult
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Usage: cli <command>');
    });

    test('a two-block sequence shares one working directory', async () => {
        // Given - build writes dist/, start reads it — one cwd, two blocks
        const result = await cli.run('build-then-start.cli');

        // Then - the file proved the sequence; the cwd is readable afterwards
        expect(result.file('dist/index.js').exists).toBe(true);
    });

    test('a header env set and an inline pair both reach the child', async () => {
        // Given - `env: frozen EXTRA=inline`
        const result = await cli.run('frozen-env.cli');

        // Then - the set's value reached the child, and so did the pair
        expect(result.stdout).toContain('MY_VAR=from-the-frozen-set');
    });

    test('a served URL matches through {{url}} whatever port was free', async () => {
        // Given - the echo server started by the header, on an OS-picked port
        const result = await cli.run('backend.cli');

        // Then - the file matched the URL by token; the raw value is a real one
        expect(result.stdout.comparableText).toMatch(/backend http:\/\/127\.0\.0\.1:\d+\//);
    });
});

describe('literate — refusals', () => {
    test('a header missing `then:` names the file and the rule', async () => {
        // Given - a .cli carrying only two of the three narrative lines
        const message = await failureOf(cli.run('fixtures/broken-header.cli'));

        // Then - the refusal names the missing narrative line
        expect(message).toContain('missing "then:" in the header');
    });

    test('a header key outside the closed set names the line and the vocabulary', async () => {
        // Given - a `when:` line
        const message = await failureOf(cli.run('fixtures/unknown-key.cli'));

        // Then - the closed vocabulary is spelled out in the refusal
        expect(message).toContain('unknown header key "when:"');
        expect(message).toContain('known keys: test, given, then, fixture, env, serve');
    });

    test('a wrong stdout renders the narrative, the command and a line diff', async () => {
        // Given - a golden nobody updated (frozen: its mismatch IS the subject)
        const message = await failureOf(cli.run('fixtures/wrong-stdout.cli', { frozen: true }));

        // Then - the whole rendering, tokens covering the path and the run cwd
        expect(text(message)).toMatch('wrong-stdout-error.txt');
    });

    test('a wrong exit code names both codes and what stderr carried', async () => {
        // Given - a golden claiming a failing command succeeds
        const message = await failureOf(cli.run('fixtures/wrong-exit.cli', { frozen: true }));

        // Then - the whole rendering, stderr included
        expect(text(message)).toMatch('wrong-exit-error.txt');
    });

    test('the stack carries ONE frame, on the block that failed', async () => {
        // Given - a golden whose block is deliberately wrong
        const error = await errorOf(cli.run('fixtures/wrong-stdout.cli', { frozen: true }));

        // Then - no engine frames, no generated-module frame: the `.cli` block
        // Line, which is what the message names too
        expect(frames(error)).toEqual([
            `at ${resolve(import.meta.dirname, 'fixtures/wrong-stdout.cli')}:5:1`,
        ]);
        expect(error.message).toContain('fixtures/wrong-stdout.cli:5');
    });

    test('a grammar refusal points at the offending header line, not at the engine', async () => {
        // Given - a header carrying a key outside the closed set (line 4)
        const error = await errorOf(cli.run('fixtures/unknown-key.cli'));

        // Then - the frame is the header line, not a parser frame
        expect(frames(error)).toEqual([
            `at ${resolve(import.meta.dirname, 'fixtures/unknown-key.cli')}:4:1`,
        ]);
    });

    test('a matched token line is not marked as a difference beside the real one', async () => {
        // Given - a block whose {{url}} matched and whose next line did not
        const path = scratchFile(
            'test: renders only the real cause\n' +
                'given: a golden whose url token matched and whose second line did not\n' +
                'then: the diff marks the second line alone\n' +
                'serve: echo\n\n$ backend\nexit: 0\nbackend {{url}}\nnot printed at all\n',
        );

        // Then - the token line is shown as equal, with its token
        const message = await failureOf(cli.run(path));
        expect(message).toContain('  backend {{url}}');
        expect(message).not.toContain('- backend {{url}}');
        expect(message).toContain('- not printed at all');
    });

    test('an unregistered server name lists what the runner declares', async () => {
        // Given - a header naming a server nobody registered
        const path = scratchFile(
            'test: names a server that does not exist\n' +
                'given: a serve line with an unknown name\n' +
                'then: the refusal lists the registered servers\n' +
                'serve: ghost\n\n$ help\nexit: 0\n',
        );

        // Then - the refusal lists what specification.cli() actually declares
        expect(await failureOf(cli.run(path))).toContain('registered servers: echo');
    });
});

describe('literate — update mode (CONVENTIONS D5)', () => {
    test('rewrites the blocks and never the header', async () => {
        // Given - a file whose golden is stale in both streams
        const path = scratchFile(
            '# a comment the rewrite must keep\n' +
                'test: rewrites what follows each $\n' +
                'given: a stale golden\n' +
                'then: the blocks refresh and the header survives byte for byte\n\n' +
                '$ fail\nexit: 0\nstale stdout\n',
        );

        // Given - one update run
        process.env.TEST_UPDATE = '1';
        try {
            await cli.run(path);
        } finally {
            delete process.env.TEST_UPDATE;
        }

        // Then - the header is untouched and the blocks now hold the truth
        const written = readFileSync(path, 'utf8');
        expect(written).toContain('# a comment the rewrite must keep');
        expect(written).toContain('given: a stale golden');
        expect(written).toContain('exit: 2');
        expect(written).toContain('--- stderr\nStarting...\nFatal: something went wrong');

        // Then - the rewritten file passes on a normal run
        await cli.run(path);
    });

    test('{{url}} survives a port change: the second server gets another port', async () => {
        // Given - a golden already tokenised, updated against a fresh server
        const source =
            'test: keeps the url token across runs\n' +
            'given: the echo server, on a port the OS picks anew each run\n' +
            'then: the token is preserved instead of being pinned to a port\n' +
            'serve: echo\n\n$ backend\nexit: 0\nbackend {{url}}\n';
        const path = scratchFile(source);

        // Given - two update runs, each with its own server and port
        process.env.TEST_UPDATE = '1';
        try {
            await cli.run(path);
            const first = readFileSync(path, 'utf8');
            await cli.run(path);

            // Then - the token was never replaced by a run-specific URL
            expect(first).toContain('backend {{url}}');
            expect(readFileSync(path, 'utf8')).toBe(source);
        } finally {
            delete process.env.TEST_UPDATE;
        }
    });

    test('a mid-file insertion keeps the tokens of the lines it shifted', async () => {
        // Given - a golden whose token line sits above the line a new command
        // Adds; the update must recognise it where it landed, not by index
        const path = scratchFile(
            'test: survives a new line appearing above a token\n' +
                'given: a golden written before the binary grew a line\n' +
                'then: the shifted token line is re-paired by pattern\n\n' +
                '$ version\nexit: 0\ncli-app v{{semver}}\ncwd {{workdir}}\n',
        );

        // Given - one update run against output carrying two EXTRA lines
        process.env.TEST_UPDATE = '1';
        try {
            await cli.run(path);
        } finally {
            delete process.env.TEST_UPDATE;
        }

        // Then - both tokens survived the shift, and nothing was pinned
        const written = readFileSync(path, 'utf8');
        expect(written).toContain('cli-app v{{semver}}');
        expect(written).toContain('cwd {{workdir}}');
        expect(written).not.toContain('cwd /');
    });

    test('a frozen file is never rewritten under TEST_UPDATE', async () => {
        // Given - a deliberately-wrong golden, run in update mode
        const before = readFileSync(
            resolve(import.meta.dirname, 'fixtures/wrong-stdout.cli'),
            'utf8',
        );
        process.env.TEST_UPDATE = '1';
        let message: string;
        try {
            message = await failureOf(cli.run('fixtures/wrong-stdout.cli', { frozen: true }));
        } finally {
            delete process.env.TEST_UPDATE;
        }

        // Then - it still threw its diff, and the file on disk is untouched
        expect(message).toContain('Literate spec mismatch');
        expect(
            readFileSync(resolve(import.meta.dirname, 'fixtures/wrong-stdout.cli'), 'utf8'),
        ).toBe(before);
    });
});
