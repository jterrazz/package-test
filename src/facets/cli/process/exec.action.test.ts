import { existsSync } from 'node:fs';
import { describe, expect, onTestFinished, test } from 'vitest';

import type { CliResult } from '../../../expectations/command/cli.result.js';
import { defineFacet } from '../../../kernel/chain/define-facet.js';
import type { CliEnv, CliOutput, CliPort, ExecOptions } from './cli.port.js';
import { env } from './env.capability.js';
import type { EnvMethod } from './env.capability.js';
import { exec } from './exec.action.js';

/** A command adapter that records what its last run was handed — mocks are code (CONVENTIONS I4). */
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

/** A chain composed of `.env()`, ending on `.exec()`. */
type Chain = {
    env: EnvMethod<Chain>;
    exec: (args?: string | string[], options?: ExecOptions) => Promise<CliResult>;
};

/** A chain running its commands through `command`. */
function chainOver(command: CliPort): Chain {
    return defineFacet<Chain>()({
        actions: [exec],
        capabilities: [env],
        engines: () => ({ command }),
        locate: () => import.meta.dirname,
        options: {},
    }).open({});
}

describe('.exec() — the arguments a command runs with', () => {
    test('refuses an empty sequence', async () => {
        // Given - a chain over a command that records its runs
        const chain = chainOver(new RecordingCommand());

        // Then - an empty command sequence is a usage error, and `.exec()` answers it as a rejection
        await expect(chain.exec([])).rejects.toThrow('exec([]) requires at least one command');
    });

    test('refuses a sequence with waitFor/timeout', async () => {
        // Given - a command sequence plus long-running options
        const chain = chainOver(new RecordingCommand());

        // Then - the combination is refused
        await expect(chain.exec(['a', 'b'], { waitFor: 'x' })).rejects.toThrow(
            'not supported with a command sequence',
        );
    });

    test('with no arguments, runs the binary bare', async () => {
        // Given - a chain over a command that records its arguments
        const command = new RecordingCommand();

        // When - the binary is run with no arguments
        await chainOver(command).exec();

        // Then - the adapter received no CLI arguments, rather than an error
        expect(command.lastArgs).toBe('');
    });

    test("hands the command the chain's environment", async () => {
        // Given - a chain stating one variable
        const command = new RecordingCommand();

        // When - the command runs
        await chainOver(command).env({ TZ: 'UTC' }).exec('status');

        // Then - the child starts with it
        expect(command.lastEnv).toStrictEqual({ TZ: 'UTC' });
    });
});

describe('.exec() — the folder a command runs in', () => {
    test('exists while the test runs, and is removed once it has finished', async () => {
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
