import { existsSync } from 'node:fs';
import { describe, expect, onTestFinished, test } from 'vitest';

import type { CliResult } from '../../../expectations/command/cli.result.js';
import { defineFacet } from '../../../kernel/chain/define-facet.js';
import type { CliEnv, CliOutput, CliPort, ExecOptions } from './cli.port.js';
import { env } from './env.capability.js';
import type { EnvMethod } from './env.capability.js';
import { exec } from './exec.action.js';

class RecordingCommand implements CliPort {
    lastArgs: string | undefined;
    lastCwd: string | undefined;
    lastEnv: CliEnv | undefined;

    async exec(args: string, cwd: string, childEnv?: CliEnv): Promise<CliOutput> {
        this.lastArgs = args;
        this.lastCwd = cwd;
        this.lastEnv = childEnv;
        return await Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
    }

    async watch(): Promise<CliOutput> {
        return await Promise.resolve({ exitCode: 0, stderr: '', stdout: '' });
    }
}

type Chain = {
    env: EnvMethod<Chain>;
    exec: (args?: string | string[], options?: ExecOptions) => Promise<CliResult>;
};

function chainOver(command: CliPort): Chain {
    return defineFacet<Chain>()({
        actions: [exec],
        capabilities: [env],
        adapters: () => ({ command }),
        locate: () => import.meta.dirname,
        options: {},
    }).open({});
}

describe('exec', () => {
    test('.exec() — the arguments a command runs with — refuses an empty sequence', async () => {
        // Given - a chain over a command that records its runs
        const chain = chainOver(new RecordingCommand());

        // Then - an empty command sequence is a usage error, and `.exec()` answers it as a rejection
        await expect(chain.exec([])).rejects.toThrow(
            new Error(
                [
                    'found: .exec([]), a sequence of no command',
                    'why: A sequence runs its commands in order, and runs at least one.',
                    "fix: name at least one command: .exec(['build', 'test'])",
                    'read: docs/12-cli.md#sequences-array-form',
                ].join('\n'),
            ),
        );
    });

    test('.exec() — the arguments a command runs with — refuses a sequence with waitFor/timeout', async () => {
        // Given - a command sequence plus long-running options
        const chain = chainOver(new RecordingCommand());

        // Then - the combination is refused
        await expect(chain.exec(['a', 'b'], { waitFor: 'x' })).rejects.toThrow(
            new Error(
                [
                    'found: .exec([…], { waitFor/timeout }), options on a command sequence',
                    'why: `waitFor` and `timeout` wait on one long-running process.',
                    'fix: wait on one long-running command: .exec(args, { waitFor, timeout }), or drop the options',
                    'read: docs/12-cli.md#long-running-processes-waitfor--timeout',
                ].join('\n'),
            ),
        );
    });

    test('.exec() — the arguments a command runs with — with no arguments, runs the binary bare', async () => {
        // Given - a chain over a command that records its arguments
        const command = new RecordingCommand();

        // When - the binary is run with no arguments
        await chainOver(command).exec();

        // Then - the adapter received no CLI arguments, rather than an error
        expect(command.lastArgs).toBe('');
    });

    test(".exec() — the arguments a command runs with — hands the command the chain's environment", async () => {
        // Given - a chain stating one variable
        const command = new RecordingCommand();

        // When - the command runs
        await chainOver(command).env({ TZ: 'UTC' }).exec('status');

        // Then - the child starts with it
        expect(command.lastEnv).toStrictEqual({ TZ: 'UTC' });
    });

    test('.exec() — the folder a command runs in — exists while the test runs, and is removed once it has finished', async () => {
        // Given - a check that runs after the test's own teardowns, and a chain over a recording command
        const command = new RecordingCommand();
        onTestFinished(() => {
            expect(existsSync(command.lastCwd ?? '')).toBe(false);
        });

        // When - a command runs
        await chainOver(command).exec('go');

        // Then - it ran in a folder that is there for the rest of the test
        expect(existsSync(command.lastCwd ?? '')).toBe(true);
    });
});
