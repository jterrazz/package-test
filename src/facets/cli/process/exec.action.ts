import { safeRealpath } from '../../../../lint/kit/project/resolve.js';
import { defineAction } from '../../../chain/action.js';
import type { ChainSignature } from '../../../chain/capability.js';
import { scratchDirectory } from '../../../chain/paths/scratch.js';
import { refusal } from '../../../chain/refusals/refusal.js';
import { CLI_RESULT_ROWS, CliResult } from '../../../expectations/command/cli.result.js';
import type { CliConfig } from '../cli.handle.js';
import type { CliOutput, CliPort, ExecOptions } from './cli.port.js';
import { env as chainEnv, childEnv } from './env.capability.js';

export type ExecSignature = ChainSignature & {
    readonly chain: {
        /** Run the binary and resolve with the result; with `{ waitFor, timeout }` the process is long-running. */
        exec: (args?: string | string[], options?: ExecOptions) => Promise<CliResult>;
    };
};

/** A sequence stops at the first non-zero exit. The one execution method (`disk-named-by-relative-path`). */
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
            throw new Error(
                refusal({
                    fix: "name at least one command: .exec(['build', 'test'])",
                    found: '.exec([]), a sequence of no command',
                    read: 'docs/14-cli.md#sequences-array-form',
                    why: 'A sequence runs its commands in order, and runs at least one.',
                }),
            );
        }
        if (options && Array.isArray(args)) {
            throw new Error(
                refusal({
                    fix: 'wait on one long-running command: .exec(args, { waitFor, timeout }), or drop the options',
                    found: '.exec([…], { waitFor/timeout }), options on a command sequence',
                    read: 'docs/14-cli.md#long-running-processes-waitfor--timeout',
                    why: '`waitFor` and `timeout` wait on one long-running process.',
                }),
            );
        }
        return { workDir: scratchDirectory('spec-command-') };
    },
    row: { group: 'Terminal action', name: '.exec()', probe: '.exec(' },
});
