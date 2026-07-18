import { spawn, spawnSync } from 'node:child_process';

import type { CliEnv, CliOutput, CliPort, ExecOptions } from '../../ports/cli.port.js';

const DEFAULT_WATCH_TIMEOUT = 10_000;
/** Grace period between SIGTERM and the SIGKILL escalation. */
const KILL_GRACE_MS = 2000;

/**
 * Build a child-process env from the parent env plus user overrides.
 * `null` overrides delete keys (e.g. `INIT_CWD: null`).
 *
 * @internal Exported for unit tests.
 */
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

/** The minimal child-process surface {@link observeProcess} drives. */
export interface ObservableProcess {
    kill: (signal?: NodeJS.Signals | number) => boolean;
    on: (event: 'exit', listener: (code: null | number) => void) => unknown;
    stderr: null | { on: (event: 'data', listener: (data: Buffer | string) => void) => unknown };
    stdout: null | { on: (event: 'data', listener: (data: Buffer | string) => void) => unknown };
}

/**
 * Observe a long-running child (`.exec(args, { waitFor, timeout })`):
 * resolve with exit code 0 as soon as `waitFor` appears in stdout/stderr,
 * with the process's own code when it exits first, and with 124 at the
 * timeout. On resolution the child is terminated with SIGTERM, escalating
 * to SIGKILL after a 2 s grace period; all timers are cleared on exit and
 * the timeout timer is unref'd so it never holds the runner open.
 *
 * @internal Exported for unit tests (driven with a fake child).
 */
export function observeProcess(child: ObservableProcess, options: ExecOptions): Promise<CliOutput> {
    const timeout = options.timeout ?? DEFAULT_WATCH_TIMEOUT;
    const waitFor = options.waitFor;

    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let resolved = false;
        let exited = false;
        let patternMatched = false;
        let killTimer: NodeJS.Timeout | null = null;

        const timeoutTimer = setTimeout(() => finish(124), timeout);
        timeoutTimer.unref?.();

        const terminate = () => {
            if (exited) {
                return;
            }
            child.kill('SIGTERM');
            // Escalate if the child ignores SIGTERM. Cleared on exit.
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

        // Process exited before the pattern matched. Without a pattern,
        // A clean exit within the timeout is a success.
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
            // A pattern was expected but never appeared — even a clean
            // Exit is a failure.
            finish(code === 0 ? 1 : (code ?? 1));
        });
    });
}

/**
 * Executes commands via Node.js child_process.
 * Uses `spawnSync` for one-shot commands and `spawn` for long-running
 * processes (`.exec(args, { waitFor, timeout })`).
 *
 * Both paths run the full command line through the shell — quoting behaves
 * identically whether or not `waitFor` is used.
 *
 * `spawnSync` is used (over the simpler `execSync`) so stdout AND stderr are
 * captured regardless of exit code. Many CLIs follow the Unix convention of
 * writing status banners to stderr on success — `execSync` would silently
 * discard them, leaving snapshot tests with no output to assert on.
 */
export class ExecAdapter implements CliPort {
    private command: string;

    constructor(command: string) {
        this.command = command;
    }

    async exec(args: string, cwd: string, extraEnv?: CliEnv): Promise<CliOutput> {
        const env = buildEnv(extraEnv);
        const result = spawnSync(`${this.command} ${args}`, [], {
            cwd,
            encoding: 'utf8',
            env,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return {
            exitCode: result.status ?? 1,
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
        // Same shell invocation as the one-shot path — no naive whitespace
        // Split, so quoted arguments behave identically in both forms.
        //
        // `detached` puts the child in its OWN process group (POSIX), so
        // Termination can target the whole group: killing only the direct
        // Shell child would orphan its descendants (a `tsdown --watch`
        // Grandchild survives the spec and leaks). No effect sought on
        // Windows — the group kill below degrades to a direct kill there.
        const child = spawn(`${this.command} ${args}`, [], {
            cwd,
            detached: process.platform !== 'win32',
            env,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Group-aware kill: signal the process GROUP (negative pid) so every
        // Descendant gets SIGTERM/SIGKILL too; fall back to the direct child
        // Kill when groups are unsupported (Windows) or the group is gone.
        const kill = (signal?: NodeJS.Signals | number): boolean => {
            if (child.pid !== undefined && process.platform !== 'win32') {
                try {
                    process.kill(-child.pid, signal ?? 'SIGTERM');
                    return true;
                } catch {
                    // Group already reaped (ESRCH) or not killable — fall through.
                }
            }
            return child.kill(signal);
        };
        return observeProcess(
            { kill, on: child.on.bind(child), stderr: child.stderr, stdout: child.stdout },
            options,
        );
    }
}
