/* oxlint-disable vitest/no-restricted-vi-methods -- this file tests the ADAPTER's own deadline: `clock` pins the calendar, and what has to move here is the timer queue the adapter waits on, which only vitest's fake timers hold */
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { buildEnv, observeProcess } from './exec.adapter.js';
import type { ObservableProcess } from './exec.adapter.js';

class FakeChild implements ObservableProcess {
    exitListeners: ((code: null | number) => void)[] = [];
    killed: (NodeJS.Signals | number | undefined)[] = [];
    private readonly stderrListeners: ((data: Buffer | string) => void)[] = [];
    private readonly stdoutListeners: ((data: Buffer | string) => void)[] = [];

    stderr = {
        on: (_event: 'data', listener: (data: Buffer | string) => void) =>
            this.stderrListeners.push(listener),
    };

    stdout = {
        on: (_event: 'data', listener: (data: Buffer | string) => void) =>
            this.stdoutListeners.push(listener),
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

    on(_event: 'exit', listener: (code: null | number) => void): unknown {
        return this.exitListeners.push(listener);
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
});
