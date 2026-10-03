import { spawn, spawnSync } from 'node:child_process';

import type { CliEnv, CliInput, CliOutput, CliPort, ExecOptions } from './cli.port.js';

const DEFAULT_WATCH_TIMEOUT = 10_000;
/** Grace period between SIGTERM and the SIGKILL escalation. */
const KILL_GRACE_MS = 2000;

/** `null` overrides delete keys (`INIT_CWD: null`). */
export function buildEnv(extra?: CliEnv): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, INIT_CWD: undefined };
    if (extra) {
        for (const [key, value] of Object.entries(extra)) {
            if (value === null) {
                delete env[key];
            } else {
                env[key] = value;
            }
        }
    }
    return env;
}

export type ObservableProcess = {
    kill: (signal?: NodeJS.Signals | number) => boolean;
    on: (event: 'exit', listener: (code: null | number) => void) => unknown;
    stderr: null | { on: (event: 'data', listener: (data: Buffer | string) => void) => unknown };
    stdout: null | { on: (event: 'data', listener: (data: Buffer | string) => void) => unknown };
};

/** Resolves 0 when `waitFor` appears, the exit code when the process ends first, 124 at the timeout; the timeout timer is unref'd. */
export async function observeProcess(
    child: ObservableProcess,
    options: ExecOptions,
): Promise<CliOutput> {
    const timeout = options.timeout ?? DEFAULT_WATCH_TIMEOUT;
    const { waitFor } = options;

    return await new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let resolved = false;
        let exited = false;
        let patternMatched = false;
        let killTimer: NodeJS.Timeout | null = null;

        const timeoutTimer = setTimeout(() => {
            finish(124);
        }, timeout);
        timeoutTimer.unref?.();

        const terminate = () => {
            if (exited) {
                return;
            }
            child.kill('SIGTERM');
            // hazard: escalate if the child ignores SIGTERM. Cleared on exit.
            killTimer = setTimeout(() => {
                if (!exited) {
                    child.kill('SIGKILL');
                }
            }, KILL_GRACE_MS);
        };

        const finish = (exitCode: number) => {
            if (resolved) {
                return;
            }
            resolved = true;
            clearTimeout(timeoutTimer);
            terminate();
            resolve({ exitCode, stderr, stdout });
        };

        const checkPattern = () => {
            if (
                waitFor !== undefined &&
                !patternMatched &&
                (stdout.includes(waitFor) || stderr.includes(waitFor))
            ) {
                patternMatched = true;
                finish(0);
            }
        };

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
            checkPattern();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
            checkPattern();
        });

        // invariant: exited before the pattern matched: without a pattern a clean exit is a success.
        child.on('exit', (code) => {
            exited = true;
            if (killTimer) {
                clearTimeout(killTimer);
            }
            if (patternMatched) {
                return;
            }
            if (waitFor === undefined) {
                finish(code ?? 1);
                return;
            }
            // invariant: a pattern was expected: even a clean exit is a failure.
            finish(code === 0 ? 1 : (code ?? 1));
        });
    });
}

/** `spawnSync` over `execSync`: stdout and stderr are captured whatever the exit code, and many CLIs write banners to stderr. */
export class ExecAdapter implements CliPort {
    private readonly command: string;

    constructor(command: string) {
        this.command = command;
    }

    async exec(args: string, cwd: string, extraEnv?: CliEnv, input?: CliInput): Promise<CliOutput> {
        const env = buildEnv(extraEnv);
        const result = spawnSync(`${this.command} ${args}`, [], {
            cwd,
            encoding: 'utf8',
            env,
            // outside: absent `input` still closes stdin: the child reads EOF, never a TTY.
            input: input?.stdin,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: input?.timeout,
        });
        // invariant: a killed run reports 124, as the long-running path does for a timeout.
        // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- `spawnSync` types `error` as `Error`, which carries no `code`; the assertion is what reaches it
        const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
        return {
            exitCode: timedOut ? 124 : (result.status ?? 1),
            stderr: result.stderr ?? '',
            stdout: result.stdout ?? '',
        };
    }

    async watch(
        args: string,
        cwd: string,
        options: ExecOptions,
        extraEnv?: CliEnv,
    ): Promise<CliOutput> {
        const env = buildEnv(extraEnv);
        // hazard: `detached` gives the child its own process group, so a `tsdown --watch` grandchild dies with it.
        const child = spawn(`${this.command} ${args}`, [], {
            cwd,
            detached: process.platform !== 'win32',
            env,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // outside: signal the process group (negative pid); fall back to the child where groups are unsupported.
        const kill = (signal?: NodeJS.Signals | number): boolean => {
            if (child.pid !== undefined && process.platform !== 'win32') {
                try {
                    process.kill(-child.pid, signal ?? 'SIGTERM');
                    return true;
                } catch {
                    // outside: group already reaped (ESRCH) or not killable — fall through.
                }
            }
            return child.kill(signal);
        };
        return await observeProcess(
            { kill, on: child.on.bind(child), stderr: child.stderr, stdout: child.stdout },
            options,
        );
    }
}
