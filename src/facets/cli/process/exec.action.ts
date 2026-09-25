import { CLI_RESULT_ROWS, CliResult } from '../../../expectations/command/cli.result.js';
import { defineAction } from '../../../kernel/chain/action.js';
import type { ChainSignature } from '../../../kernel/chain/capability.js';
import { safeRealpath } from '../../../kernel/files/resolve.js';
import { scratchDirectory } from '../../../kernel/files/scratch.js';
import type { CliConfig } from '../cli.handle.js';
import type { CliOutput, CliPort, ExecOptions } from './cli.port.js';
import { env as chainEnv, childEnv } from './env.capability.js';

/** What `.exec()` puts on a chain. */
export type ExecSignature = ChainSignature & {
    readonly chain: {
        /**
         * Execute the command (or sequence of commands) and resolve with the
         * result. Called with no arguments (`cli.exec()`), the binary runs bare —
         * no CLI arguments. With `{ waitFor, timeout }`, the process is
         * long-running: it resolves when the pattern appears and is killed at the
         * timeout.
         */
        exec: (args?: string | string[], options?: ExecOptions) => Promise<CliResult>;
    };
};

/**
 * `.exec(args?, options?)`: run the binary — bare, one command, or a sequence
 * stopping at the first non-zero exit — in a fresh, empty working directory,
 * and resolve with the result. With `{ waitFor, timeout }` the process is
 * long-running: it resolves when the pattern appears and is killed at the
 * timeout. The one execution method (CONVENTIONS B2).
 */
export const exec = defineAction<
    'exec',
    [args?: string | string[], options?: ExecOptions],
    CliResult,
    ExecSignature,
    { command: CliPort },
    CliConfig
>({
    accessors: CLI_RESULT_ROWS,
    name: 'exec',
    perform: async ([args = '', options], read, { command }, { config, testDir, workDir }) => {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- `prepare` always answers a directory: a command never runs in the source tree
        const cwd = workDir!;
        const env = childEnv(config, read(chainEnv), safeRealpath(cwd));
        let output: CliOutput;
        if (options) {
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `prepare` refused a sequence with options: one command is what reaches here
            output = await command.watch(args as string, cwd, options, env);
        } else if (Array.isArray(args)) {
            output = { exitCode: 0, stderr: '', stdout: '' };
            for (const one of args) {
                // oxlint-disable-next-line eslint/no-await-in-loop -- a sequence runs in order and stops at the first command that fails
                output = await command.exec(one, cwd, env);
                if (output.exitCode !== 0) {
                    break;
                }
            }
        } else {
            output = await command.exec(args, cwd, env);
        }
        return new CliResult({
            commandOutput: output,
            config,
            dockerConfig: config.dockerConfig ?? undefined,
            testDir,
            testRunId: config.dockerTestRunId ?? undefined,
            transform: config.transform,
            workDir: cwd,
        });
    },
    prepare: ([args = '', options]) => {
        if (Array.isArray(args) && args.length === 0) {
            throw new Error('exec([]) requires at least one command');
        }
        if (options && Array.isArray(args)) {
            throw new Error(
                '.exec(): waitFor/timeout options are not supported with a command sequence',
            );
        }
        return { workDir: scratchDirectory('spec-command-') };
    },
    row: { group: 'Terminal action', name: '.exec()', probe: '.exec(' },
});
