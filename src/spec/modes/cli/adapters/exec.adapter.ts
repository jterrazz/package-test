import { spawn, spawnSync } from 'node:child_process';

import type { CommandEnv, CommandPort, CommandResult, SpawnOptions } from '../command.port.js';

/**
 * Build a child-process env from the parent env plus user overrides.
 * `null` overrides delete keys (e.g. `INIT_CWD: null`).
 */
function buildEnv(extra?: CommandEnv): NodeJS.ProcessEnv {
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

/**
 * Executes CLI commands via Node.js child_process.
 * Uses `spawnSync` for one-shot commands and `spawn` for long-running processes.
 * Used by the command() specification runner.
 *
 * `spawnSync` is used (over the simpler `execSync`) so stdout AND stderr are
 * captured regardless of exit code. Many CLIs follow the Unix convention of
 * writing status banners to stderr on success — `execSync` would silently
 * discard them, leaving snapshot tests with no output to assert on.
 */
export class ExecAdapter implements CommandPort {
    private command: string;

    constructor(command: string) {
        this.command = command;
    }

    async exec(args: string, cwd: string, extraEnv?: CommandEnv): Promise<CommandResult> {
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
            stdout: result.stdout ?? '',
            stderr: result.stderr ?? '',
        };
    }

    async spawn(
        args: string,
        cwd: string,
        options: SpawnOptions,
        extraEnv?: CommandEnv,
    ): Promise<CommandResult> {
        const env = buildEnv(extraEnv);

        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let resolved = false;

            const child = spawn(this.command, args.split(/\s+/).filter(Boolean), {
                cwd,
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            const finish = (exitCode: number) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                child.kill('SIGTERM');
                resolve({ exitCode, stdout, stderr });
            };

            let patternMatched = false;

            const checkPattern = () => {
                if (
                    !patternMatched &&
                    (stdout.includes(options.waitFor) || stderr.includes(options.waitFor))
                ) {
                    patternMatched = true;
                    finish(0);
                }
            };

            child.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
                checkPattern();
            });

            child.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
                checkPattern();
            });

            // Process exited before pattern matched
            child.on('exit', (code) => {
                if (!patternMatched) {
                    finish(code === 0 ? 1 : (code ?? 1));
                }
            });

            setTimeout(() => finish(124), options.timeout);
        });
    }
}
