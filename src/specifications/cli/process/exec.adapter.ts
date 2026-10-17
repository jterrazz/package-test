import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { onTestFinished } from 'vitest';

import {
    KILL_GRACE_MS,
    signalGroup,
    SIGNALS_GROUPS,
} from '../../../services/process/process-group.js';
import type { CliEnv, CliInput, CliOutput, CliPort, WatchOptions } from './cli.port.js';

const DEFAULT_WATCH_TIMEOUT = 10_000;
// invariant: one exit code for a run killed at its timeout, whichever path ran it.
const TIMED_OUT = 124;

// outside: the mutation run hands every process a test spawns the coverage reporter in NODE_OPTIONS (`--require=".../child-coverage.cjs"`); a chain that states its own NODE_OPTIONS must not drop it.
const COVERAGE_REPORTER = /--require="[^"]*child-coverage\.cjs"/u;

function withCoverageReporter(extra: CliEnv | undefined): CliEnv | undefined {
    const stated = extra?.NODE_OPTIONS;
    const reporter = COVERAGE_REPORTER.exec(process.env.NODE_OPTIONS ?? '')?.[0];
    // Stryker disable next-line ConditionalExpression: an env that is absent states no NODE_OPTIONS, which the type test beside it refuses all the same
    const unstated = extra === undefined || typeof stated !== 'string';
    if (unstated || reporter === undefined) {
        return extra;
    }

    return stated.includes(reporter)
        ? extra
        : { ...extra, NODE_OPTIONS: `${stated} ${reporter}`.trim() };
}

/** `null` overrides delete keys (`INIT_CWD: null`); a NODE_OPTIONS a chain states keeps the mutation reporter the run asked for. */
export function buildEnv(stated?: CliEnv): NodeJS.ProcessEnv {
    const extra = withCoverageReporter(stated);
    const unset = new Set(
        Object.entries(extra ?? {})
            .filter(([, value]) => value === null)
            .map(([key]) => key),
    );
    return Object.fromEntries(
        Object.entries({ ...process.env, INIT_CWD: undefined, ...extra }).filter(
            ([key]) => !unset.has(key),
        ),
    );
}

export type ObservableProcess = {
    kill: (signal?: NodeJS.Signals | number) => boolean;
    on: (event: 'exit', listener: (code: null | number) => void) => unknown;
    stderr: null | { on: (event: 'data', listener: (data: Buffer | string) => void) => unknown };
    stdout: null | { on: (event: 'data', listener: (data: Buffer | string) => void) => unknown };
};

// invariant: SIGTERM, then SIGKILL once the grace has passed: the child's exit clears the timer before then.
function terminate(child: ObservableProcess): NodeJS.Timeout {
    child.kill('SIGTERM');
    return setTimeout(() => {
        child.kill('SIGKILL');
    }, KILL_GRACE_MS);
}

/** invariant: with a pattern expected, even a clean exit is a failure; without one a clean exit is a success. */
function exitCodeOf(code: null | number, waitFor: string | undefined): number {
    if (waitFor !== undefined && code === 0) {
        return 1;
    }
    return code ?? 1;
}

/** Resolves 0 when `waitFor` appears, the exit code when the process ends first, 124 at the timeout; the timeout timer is unref'd. */
export async function observeProcess(
    child: ObservableProcess,
    options: WatchOptions,
): Promise<CliOutput> {
    const { waitFor } = options;
    return await new Promise((resolve) => {
        const output = { stderr: '', stdout: '' };
        let resolved = false;
        let exited = false;
        let killTimer: NodeJS.Timeout | undefined;

        const timeoutTimer = setTimeout(() => {
            finish(TIMED_OUT);
        }, options.timeout ?? DEFAULT_WATCH_TIMEOUT);
        // Stryker disable next-line CallExpression: unref'd, the timer never holds the run open, which no test inside it can see
        timeoutTimer.unref();

        function finish(exitCode: number): void {
            if (resolved) {
                return;
            }
            resolved = true;
            // Stryker disable next-line CallExpression: a timer left running fires into a resolved observation, which ignores it
            clearTimeout(timeoutTimer);
            if (!exited) {
                killTimer = terminate(child);
            }
            resolve({ exitCode, ...output });
        }

        const collect = (stream: 'stderr' | 'stdout') => (data: Buffer | string) => {
            output[stream] += data.toString();
            if (
                waitFor !== undefined &&
                (output.stdout.includes(waitFor) || output.stderr.includes(waitFor))
            ) {
                finish(0);
            }
        };
        child.stdout?.on('data', collect('stdout'));
        child.stderr?.on('data', collect('stderr'));

        child.on('exit', (code) => {
            exited = true;
            clearTimeout(killTimer);
            finish(exitCodeOf(code, waitFor));
        });
    });
}

// invariant: SIGTERM to the run's whole group, then SIGKILL once the grace has passed, to whatever of it ignored the first.
function endGroup(child: ChildProcess): void {
    signalGroup(child);
    setTimeout(() => {
        signalGroup(child, 'SIGKILL');
    }, KILL_GRACE_MS).unref();
}

/** Spawned, never `spawnSync`: the test's event loop keeps running while the binary does, so a server the test started (a collector, a stub) answers it. stdout and stderr are captured whatever the exit code, and many CLIs write banners to stderr. */
export class ExecAdapter implements CliPort {
    private readonly command: string;

    constructor(command: string) {
        this.command = command;
    }

    async exec(args: string, cwd: string, extraEnv?: CliEnv, input?: CliInput): Promise<CliOutput> {
        const env = buildEnv(extraEnv);
        // outside: a spawned child's three streams are pipes unless told otherwise.
        // hazard: `detached` gives the run its own process group: a grandchild still holding stdout dies with the shell, or 'close' never fires.
        const child = spawn(`${this.command} ${args}`, [], {
            cwd,
            detached: SIGNALS_GROUPS,
            env,
            shell: true,
        });
        // invariant: the run's group ends with the test, 'close' or not: a grandchild holding no stdio, or a child a test timeout abandoned, outlives nothing.
        onTestFinished(() => {
            endGroup(child);
        });
        return await new Promise((resolve) => {
            const output = { stderr: '', stdout: '' };
            let timedOut = false;
            const timer =
                input?.timeout === undefined
                    ? undefined
                    : setTimeout(() => {
                          timedOut = true;
                          endGroup(child);
                      }, input.timeout);
            // Stryker disable next-line StringLiteral: utf8 is the default a stream decodes to
            child.stdout.setEncoding('utf8').on('data', (data: string) => {
                output.stdout += data;
            });
            // Stryker disable next-line StringLiteral: utf8 is the default a stream decodes to
            child.stderr.setEncoding('utf8').on('data', (data: string) => {
                output.stderr += data;
            });
            child.on('close', (code) => {
                // Stryker disable next-line CallExpression: a timer left to fire kills a process already gone and marks a run already resolved
                clearTimeout(timer);
                resolve({ exitCode: timedOut ? TIMED_OUT : (code ?? 1), ...output });
            });
            // hazard: a binary that exits before reading stdin closes the pipe under the write; the run is judged by its exit, not by that error.
            // Stryker disable next-line StringLiteral,ArrowFunction,CallExpression: the pipe holds what a run pipes in before the child reads it, so the error fires only past its buffer, which no spec pipes
            child.stdin.on('error', () => undefined);
            // outside: absent `input` still closes stdin: the child reads EOF, never a TTY.
            child.stdin.end(input?.stdin);
        });
    }

    async watch(
        args: string,
        cwd: string,
        options: WatchOptions,
        extraEnv?: CliEnv,
    ): Promise<CliOutput> {
        const env = buildEnv(extraEnv);
        // hazard: `detached` gives the child its own process group, so a `tsdown --watch` grandchild dies with it.
        const child = spawn(`${this.command} ${args}`, [], {
            cwd,
            detached: SIGNALS_GROUPS,
            env,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const kill = (signal?: NodeJS.Signals | number): boolean => signalGroup(child, signal);
        return await observeProcess(
            { kill, on: child.on.bind(child), stderr: child.stderr, stdout: child.stdout },
            options,
        );
    }
}
