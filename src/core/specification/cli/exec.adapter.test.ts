import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { buildEnv, type ObservableProcess, observeProcess } from './exec.adapter.js';

/** In-code fake child (CONVENTIONS I4) — emits scripted output and records kills. */
class FakeChild implements ObservableProcess {
    exitListeners: ((code: null | number) => void)[] = [];
    killed: (NodeJS.Signals | number | undefined)[] = [];
    private stderrListeners: ((data: Buffer | string) => void)[] = [];
    private stdoutListeners: ((data: Buffer | string) => void)[] = [];

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

describe('exec adapter — buildEnv', () => {
    test('merges overrides on top of process.env; null unsets; INIT_CWD is cleared', () => {
        // Given - a known parent variable and a set of overrides
        process.env.EXEC_ADAPTER_TEST_VAR = 'parent';

        try {
            const env = buildEnv({ ADDED: 'yes', EXEC_ADAPTER_TEST_VAR: null });

            // Then - null deletes, additions land, INIT_CWD never leaks
            expect(env.ADDED).toBe('yes');
            expect('EXEC_ADAPTER_TEST_VAR' in env).toBe(false);
            expect(env.INIT_CWD).toBeUndefined();
        } finally {
            delete process.env.EXEC_ADAPTER_TEST_VAR;
        }
    });
});

describe('exec adapter — observeProcess', () => {
    let child: FakeChild;

    beforeEach(() => {
        // Given - fake timers and a scripted child
        vi.useFakeTimers();
        child = new FakeChild();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('resolves 0 when the waitFor pattern appears, then terminates the child', async () => {
        // Given - a long-running observation
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'ready' });

        // When - the pattern shows up across stdout chunks
        child.emitStdout('starting...\n');
        child.emitStdout('server ready on :3000\n');

        // Then - resolved at the pattern with the output so far, SIGTERM sent
        await expect(promise).resolves.toEqual({
            exitCode: 0,
            stderr: '',
            stdout: 'starting...\nserver ready on :3000\n',
        });
        expect(child.killed).toEqual(['SIGTERM']);
    });

    test('escalates SIGTERM to SIGKILL after the 2s grace period', async () => {
        // Given - a child that matches the pattern but ignores SIGTERM
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'ready' });
        child.emitStderr('ready\n');
        await promise;

        // When - the grace period elapses without an exit
        vi.advanceTimersByTime(2000);

        // Then - SIGKILL follows SIGTERM
        expect(child.killed).toEqual(['SIGTERM', 'SIGKILL']);
    });

    test('does not SIGKILL a child that exits within the grace period', async () => {
        // Given - a resolved observation with the child dying on SIGTERM
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'ready' });
        child.emitStdout('ready\n');
        await promise;
        child.emitExit(0);

        // When - time passes beyond the grace period
        vi.advanceTimersByTime(10_000);

        // Then - only the SIGTERM was ever sent
        expect(child.killed).toEqual(['SIGTERM']);
    });

    test('resolves 124 at the timeout when the pattern never appears', async () => {
        // Given - a silent child
        const promise = observeProcess(child, { timeout: 3000, waitFor: 'never' });

        // When - the timeout elapses
        vi.advanceTimersByTime(3000);

        // Then - exit code 124, child terminated
        await expect(promise).resolves.toMatchObject({ exitCode: 124 });
        expect(child.killed).toEqual(['SIGTERM']);
    });

    test('an exit before the pattern is a failure even with code 0', async () => {
        // Given - a waitFor observation whose child exits cleanly first
        const promise = observeProcess(child, { timeout: 5000, waitFor: 'never' });

        // When - the child exits 0 without printing the pattern
        child.emitExit(0);

        // Then - mapped to exit code 1 (pattern expected, never seen)
        await expect(promise).resolves.toMatchObject({ exitCode: 1 });
    });

    test('without waitFor, a clean exit within the timeout keeps its code', async () => {
        // Given - no pattern, just a bounded run
        const promise = observeProcess(child, { timeout: 5000 });

        // When - the child exits with its own code
        child.emitStderr('done\n');
        child.emitExit(7);

        // Then - the code is passed through with the captured streams
        await expect(promise).resolves.toEqual({ exitCode: 7, stderr: 'done\n', stdout: '' });
    });

    test('the timeout never fires after an early resolution', async () => {
        // Given - a resolved observation
        const promise = observeProcess(child, { timeout: 3000, waitFor: 'ready' });
        child.emitStdout('ready\n');
        const result = await promise;
        child.emitExit(0);

        // When - the timeout horizon passes
        vi.advanceTimersByTime(60_000);

        // Then - the resolution stands and no extra kills happened
        expect(result.exitCode).toBe(0);
        expect(child.killed).toEqual(['SIGTERM']);
    });
});
