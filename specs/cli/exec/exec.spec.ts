import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/*
 * These are exec()-capability probes: the subject under test is stream capture,
 * routing and lifecycle (stdout/stderr, exit codes, waitFor, process-group kill),
 * not the fixture CLI's output correctness. Targeted toContain probes are the right
 * level; the waitFor block is cut at an arbitrary instant (CONVENTIONS D11(b)), unstable
 * to snapshot by nature. Whole-output correctness IS a golden — see help.txt/start.txt.
 */

describe('command — exec', () => {
    test('runs a command successfully', async () => {
        // Given - the cli-app fixture project
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('build');

        // Then - clean exit
        expect(result.exitCode).toBe(0);
    });

    test('surfaces the whole usage banner on stdout', async () => {
        // Given - the help command
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('help');

        // Then - the whole usage banner is surfaced on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('help.txt');
    });

    test('captures non-zero exit code', async () => {
        // Given - a command that exits 2
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('fail');

        // Then - the exit code is preserved
        expect(result.exitCode).toBe(2);
    });

    test('captures unknown command failure', async () => {
        // Given - a command the fixture does not know
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('nonexistent');

        // Then - non-zero exit with a useful stderr
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Unknown command');
    });

    test('captures stderr on exit zero (Unix-style status banners)', async () => {
        // Given - a command that prints to stderr and exits 0, mirroring the unix convention where status banners go to stderr while data goes to stdout. spwn, gh, git, npm and many others follow this pattern.
        const result = await cli.fixture('$FIXTURES/cli-app/').exec('status-on-stderr');

        // Then - exit code is zero AND stderr is preserved (regression guard: an earlier execSync-based adapter discarded stderr on exit zero, leaving CLI consumers unable to snapshot status output).
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toBe('Operation succeeded\n');
        expect(result.stdout.text).toBe('');
    });

    test('fresh working dir — runs in a fresh empty temp dir when no fixture is set', async () => {
        // Given - no .fixture() — scaffold writes into the cwd
        const result = await cli.exec('scaffold');

        // Then - the scaffold output exists in the temp workdir
        expect(result.exitCode).toBe(0);
        expect(result.file('out/main.go').exists).toBeTruthy();
    });

    test('fresh working dir — two bare runs get independent temp dirs', async () => {
        // Given - two independent runs without a fixture
        const a = await cli.exec('scaffold');
        const b = await cli.exec('scaffold-extra');

        // Then - a does NOT see b's UNEXPECTED.txt and vice versa
        expect(a.file('out/UNEXPECTED.txt').exists).toBeFalsy();
        expect(b.file('out/UNEXPECTED.txt').exists).toBeTruthy();
    });

    test('multi-exec — runs commands sequentially in same directory', async () => {
        // Given - build then start (start needs dist/ from build)
        const result = await cli.fixture('$FIXTURES/cli-app/').exec(['build', 'start']);

        // Then - the last command's whole output is surfaced
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch('start.txt');
    });

    test('multi-exec — stops on first failure', async () => {
        // Given - fail then build (fail exits non-zero, build should not run)
        const result = await cli.fixture('$FIXTURES/cli-app/').exec(['fail', 'build']);

        // Then - stopped at fail
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('Fatal: something went wrong');
    });

    test('multi-exec — preserves files between commands', async () => {
        // Given - build creates dist/, then we check it still exists
        const result = await cli.fixture('$FIXTURES/cli-app/').exec(['build', 'check']);

        // Then - the sequence shares one working directory
        expect(result.exitCode).toBe(0);
        expect(result.file('dist/index.js').exists).toBeTruthy();
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — resolves when the waitFor pattern is matched in stdout', async () => {
        // Given - a watch-mode process that prints then keeps running
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .exec('dev', { timeout: 10_000, waitFor: 'Hello from CLI app' });

        // Then - resolved at the pattern with the output captured so far
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('Starting dev mode');
        expect(result.stdout).toContain('Hello from CLI app');
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — resolves when the waitFor pattern is matched in stderr', async () => {
        // Given - a process whose readiness banner goes to stderr
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .exec('dev-stderr', { timeout: 10_000, waitFor: 'Listening on stderr' });

        // Then - resolved at the stderr pattern with the output captured so far
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toContain('Listening on stderr');
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — waitFor without timeout defaults to 10s', async () => {
        // Given - only waitFor is set
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .exec('dev', { waitFor: 'Hello from CLI app' });

        // Then - the pattern resolved well before the default timeout
        expect(result.exitCode).toBe(0);
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — returns non-zero when the process exits without matching', async () => {
        // Given - help exits immediately without matching pattern
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .exec('help', { timeout: 5000, waitFor: 'NONEXISTENT_PATTERN' });

        // Then - exit code 1 (pattern not matched before process exited)
        expect(result.exitCode).toBe(1);
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — kills a long-running process at the timeout', async () => {
        // Given - dev runs forever but the pattern never appears
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .exec('dev', { timeout: 2000, waitFor: 'NONEXISTENT_PATTERN' });

        // Then - exit code 124 (timeout)
        expect(result.exitCode).toBe(124);
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — terminates the whole process group, not just the direct child', async () => {
        // Given - a command that spawns a looping background grandchild (like a tsdown --watch under a dev command) and records its pid
        const result = await cli
            .fixture('$FIXTURES/cli-app/')
            .exec('spawn-daemon', { timeout: 10_000, waitFor: 'daemon ready' });
        expect(result.exitCode).toBe(0);
        const daemonPid = Number(result.file('daemon.pid').content.trim());
        expect(daemonPid).toBeGreaterThan(0);

        // Then - the grandchild is dead too: killing only the shell child would orphan it (signal 0 probes liveness without signalling)
        await expect
            .poll(
                () => {
                    try {
                        process.kill(daemonPid, 0);
                        return true;
                    } catch {
                        return false;
                    }
                },
                { timeout: 5000 },
            )
            .toBe(false);
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — rejects waitFor options on a command sequence', async () => {
        // Given - an array of commands plus long-running options
        // Then - the combination is refused: `.exec()` answers a promise, so the refusal arrives as a rejection
        await expect(
            cli.fixture('$FIXTURES/cli-app/').exec(['build', 'start'], { waitFor: 'x' }),
        ).rejects.toThrow('not supported with a command sequence');
    });
});
