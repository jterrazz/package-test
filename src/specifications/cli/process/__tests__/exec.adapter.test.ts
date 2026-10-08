/* oxlint-disable vitest/no-restricted-vi-methods -- this file tests the ADAPTER's own deadline: `clock` pins the calendar, and what has to move here is the timer queue the adapter waits on, which only vitest's fake timers hold */
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { buildEnv, ExecAdapter, observeProcess } from '../exec.adapter.js';
import type { ObservableProcess } from '../exec.adapter.js';

class FakeChild implements ObservableProcess {
    exitListeners: ((code: null | number) => void)[] = [];
    killed: (NodeJS.Signals | number | undefined)[] = [];
    private readonly stderrListeners: ((data: Buffer | string) => void)[] = [];
    private readonly stdoutListeners: ((data: Buffer | string) => void)[] = [];

    stderr: ObservableProcess['stderr'] = {
        on: (event: 'data', listener: (data: Buffer | string) => void) =>
            event === 'data' && this.stderrListeners.push(listener),
    };

    stdout: ObservableProcess['stdout'] = {
        on: (event: 'data', listener: (data: Buffer | string) => void) =>
            event === 'data' && this.stdoutListeners.push(listener),
    };

    emitExit(code: null | number): void {
        for (const listener of this.exitListeners) {
            listener(code);
        }
    }

    emitStderr(text: string): void {
        for (const listener of this.stderrListeners) {
            listener(text);
        }
    }

    emitStdout(text: string): void {
        for (const listener of this.stdoutListeners) {
            listener(text);
        }
    }

    kill(signal?: NodeJS.Signals | number): boolean {
        this.killed.push(signal);
        return true;
    }

    on(event: 'exit', listener: (code: null | number) => void): unknown {
        return event === 'exit' && this.exitListeners.push(listener);
    }
}

function givenChild(): FakeChild {
    vi.useFakeTimers();
    onTestFinished(() => {
        vi.useRealTimers();
    });
    return new FakeChild();
}

describe('ExecAdapter', () => {
    test('exec adapter — buildEnv — merges overrides on top of process.env; null unsets; INIT_CWD is cleared', () => {
        // Given - a known parent variable and a set of overrides
        vi.stubEnv('EXEC_ADAPTER_TEST_VAR', 'parent');
        vi.stubEnv('INIT_CWD', '/elsewhere');
        const env = buildEnv({ ADDED: 'yes', EXEC_ADAPTER_TEST_VAR: null });

        // Then - null deletes, additions land, INIT_CWD never leaks
        expect({
            added: env.ADDED,
            initCwd: env.INIT_CWD,
            unset: 'EXEC_ADAPTER_TEST_VAR' in env,
        }).toStrictEqual({ added: 'yes', initCwd: undefined, unset: false });
    });

    test('exec adapter — observeProcess — resolves 0 when the waitFor pattern appears, then terminates the child', async () => {
        const child = givenChild();
        // Given - a long-running observation
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'ready' });

        // When - the pattern shows up across stdout chunks
        child.emitStdout('starting...\n');
        child.emitStdout('server ready on :3000\n');

        // Then - resolved at the pattern with the output so far, SIGTERM sent
        await expect(promise).resolves.toStrictEqual({
            exitCode: 0,
            stderr: '',
            stdout: 'starting...\nserver ready on :3000\n',
        });
        expect(child.killed).toStrictEqual(['SIGTERM']);
    });

    test('exec adapter — observeProcess — escalates SIGTERM to SIGKILL after the 2s grace period', async () => {
        const child = givenChild();
        // Given - a child that matches the pattern but ignores SIGTERM
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'ready' });
        child.emitStderr('ready\n');
        await promise;

        // When - the grace period elapses without an exit
        vi.advanceTimersByTime(2000);

        // Then - SIGKILL follows SIGTERM
        expect(child.killed).toStrictEqual(['SIGTERM', 'SIGKILL']);
    });

    test('exec adapter — observeProcess — does not SIGKILL a child that exits within the grace period', async () => {
        const child = givenChild();
        // Given - a resolved observation with the child dying on SIGTERM
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'ready' });
        child.emitStdout('ready\n');
        await promise;
        child.emitExit(0);

        // When - time passes beyond the grace period
        vi.advanceTimersByTime(10_000);

        // Then - only the SIGTERM was ever sent
        expect(child.killed).toStrictEqual(['SIGTERM']);
    });

    test('exec adapter — observeProcess — resolves 124 at the timeout when the pattern never appears', async () => {
        const child = givenChild();
        // Given - a silent child
        const promise = observeProcess(child, { timeout: 3000, waitFor: 'never' });

        // When - the timeout elapses
        vi.advanceTimersByTime(3000);

        // Then - exit code 124, child terminated
        await expect(promise).resolves.toMatchObject({ exitCode: 124 });
        expect(child.killed).toStrictEqual(['SIGTERM']);
    });

    test('exec adapter — observeProcess — an exit before the pattern is a failure even with code 0', async () => {
        const child = givenChild();
        // Given - a waitFor observation whose child exits cleanly first
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'never' });

        // When - the child exits 0 without printing the pattern
        child.emitExit(0);

        // Then - mapped to exit code 1 (pattern expected, never seen)
        await expect(promise).resolves.toMatchObject({ exitCode: 1 });
    });

    test('exec adapter — observeProcess — without waitFor, a clean exit within the timeout keeps its code', async () => {
        const child = givenChild();
        // Given - no pattern, just a bounded run
        const promise = observeProcess(child, { timeout: 5000 });

        // When - the child exits with its own code
        child.emitStderr('done\n');
        child.emitExit(7);

        // Then - the code is passed through with the captured streams
        await expect(promise).resolves.toStrictEqual({ exitCode: 7, stderr: 'done\n', stdout: '' });
    });

    test('exec adapter — observeProcess — the timeout never fires after an early resolution', async () => {
        const child = givenChild();
        // Given - a resolved observation
        const promise = observeProcess(child, { timeout: 3000, waitFor: 'ready' });
        child.emitStdout('ready\n');
        const result = await promise;
        child.emitExit(0);

        // When - the timeout horizon passes
        vi.advanceTimersByTime(60_000);

        // Then - the resolution stands and no extra kills happened
        expect(result.exitCode).toBe(0);
        expect(child.killed).toStrictEqual(['SIGTERM']);
    });

    test('exec adapter — observeProcess — the exit code a run gives, with and without a pattern, and a run that ends with no code', async () => {
        // Given - runs ending each way, one printing the word undefined, one with no streams at all
        const runs: [string | undefined, null | number, string][] = [
            [undefined, 0, 'undefined\n'],
            ['never', 5, ''],
            [undefined, null, ''],
        ];
        const children = runs.map(() => givenChild());
        const silent = givenChild();
        silent.stdout = null;
        silent.stderr = null;
        const promises = runs.map(
            async ([waitFor], at) =>
                await observeProcess(children[at] ?? silent, { timeout: 5000, waitFor }),
        );
        const quiet = observeProcess(silent, { timeout: 5000 });

        // When - each prints what it prints, then exits
        for (const [at, [, code, printed]] of runs.entries()) {
            children[at]?.emitStdout(printed);
            children[at]?.emitExit(code);
        }
        silent.emitExit(3);

        // Then - each code, a pattern missed failing only a clean exit, and no exited child terminated
        const results = await Promise.all([...promises, quiet]);
        expect([
            results.map(({ exitCode }) => exitCode),
            [...children, silent].map(({ killed }) => killed),
        ]).toStrictEqual([
            [0, 5, 1, 3],
            [[], [], [], []],
        ]);
    });

    test('exec adapter — observeProcess — a pattern seen twice resolves and terminates once', async () => {
        const child = givenChild();
        // Given - a pattern printed twice
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'ready' });
        child.emitStdout('ready\n');
        child.emitStdout('ready again\n');

        // Then - one resolution, one SIGTERM
        await expect(promise).resolves.toMatchObject({ exitCode: 0 });
        expect(child.killed).toStrictEqual(['SIGTERM']);
    });

    test('exec adapter — ExecAdapter.exec — hands the command what is piped in and closes it, so a reader of stdin ends', async () => {
        // Given - a command that echoes its stdin until it closes
        const adapter = new ExecAdapter('cat');

        // Then - the piped text comes back, and the run ends on its own exit
        await expect(
            adapter.exec('', process.cwd(), {}, { stdin: 'piped in' }),
        ).resolves.toStrictEqual({
            exitCode: 0,
            stderr: '',
            stdout: 'piped in',
        });
    });
});
