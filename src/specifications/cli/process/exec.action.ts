import { statSync } from 'node:fs';
import { isAbsolute, normalize, resolve, sep } from 'node:path';

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

function isLongRunning(options: ExecOptions | undefined): options is ExecOptions {
    return options?.waitFor !== undefined || options?.timeout !== undefined;
}

function requireRelativeFolder(cwd: string | undefined): void {
    if (cwd === undefined) {
        return;
    }
    const inside = normalize(cwd);
    if (isAbsolute(cwd) || inside === '..' || inside.startsWith(`..${sep}`)) {
        throw new Error(
            refusal({
                fix: "name a folder below the working directory, relative to it: .exec('check', { cwd: 'packages/site' })",
                found: `.exec(..., { cwd: ${JSON.stringify(cwd)} }), a folder outside the working directory`,
                read: 'docs/guides/cli-specs.md#cwd-a-folder-of-the-working-directory',
                why: 'A command runs in the working directory the chain laid, or in one of its folders: anywhere else is the machine, not the fixture.',
            }),
        );
    }
}

function runFolder(root: string, cwd: string | undefined): string {
    if (cwd === undefined) {
        return root;
    }
    const folder = resolve(root, cwd);
    if (statSync(folder, { throwIfNoEntry: false })?.isDirectory() !== true) {
        throw new Error(
            refusal({
                fix: 'lay the folder with a fixture, or name one the fixtures laid',
                found: `.exec(..., { cwd: ${JSON.stringify(cwd)} }), a folder the working directory does not hold`,
                read: 'docs/guides/cli-specs.md#cwd-a-folder-of-the-working-directory',
                why: 'A command runs in a folder the chain laid: one that does not exist has no files of the fixture.',
            }),
        );
    }
    return folder;
}

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
        const root = workDir!;
        const cwd = runFolder(root, options?.cwd);
        const env = childEnv(config, read(chainEnv), safeRealpath(root));
        let output: CliOutput;
        if (isLongRunning(options)) {
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
            requests: config.backend?.requests(),
            testDir,
            testRunId: config.dockerTestRunId ?? undefined,
            transform: config.transform,
            workDir: root,
        });
    },
    prepare: ([args = '', options]) => {
        if (Array.isArray(args) && args.length === 0) {
            throw new Error(
                refusal({
                    fix: "name at least one command: .exec(['build', 'test'])",
                    found: '.exec([]), a sequence of no command',
                    read: 'docs/guides/cli-specs.md#sequences-array-form',
                    why: 'A sequence runs its commands in order, and runs at least one.',
                }),
            );
        }
        if (isLongRunning(options) && Array.isArray(args)) {
            throw new Error(
                refusal({
                    fix: 'wait on one long-running command: .exec(args, { waitFor, timeout }), or drop the options',
                    found: '.exec([...], { waitFor/timeout }), options on a command sequence',
                    read: 'docs/guides/cli-specs.md#long-running-processes-waitfor--timeout',
                    why: '`waitFor` and `timeout` wait on one long-running process.',
                }),
            );
        }
        requireRelativeFolder(options?.cwd);
        return { workDir: scratchDirectory('spec-command-') };
    },
    row: { group: 'Terminal action', name: '.exec()', probe: '.exec(' },
});
