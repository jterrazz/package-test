import type { EnvRecord } from '../../../chain/context/with.capability.js';
import type { CliOutput } from '../../../expectations/command/cli.result.js';

export type { CliOutput } from '../../../expectations/command/cli.result.js';

/** The long-running form of a command: resolves when `waitFor` appears, killed at `timeout` (exit 124). */
export type WatchOptions = {
    /** Resolve (exit code 0) when stdout/stderr contains this string. */
    waitFor?: string | undefined;
    /** Kill the process after this many milliseconds. Defaults to 10 000. */
    timeout?: number | undefined;
};

/** How `.exec()` runs: `waitFor` or `timeout` make the command long-running, `cwd` names the folder it runs in. */
export type ExecOptions = WatchOptions & {
    /** A folder of the working directory, named relative to it: a workspace member, a clone inside a repository. */
    cwd?: string | undefined;
};

/** Extra environment variables to set for the child process — the record `.env()` and `with({ env })` state. */
export type CliEnv = EnvRecord;

/** Per-run inputs; absent, the child gets an immediately-closed stdin (never a TTY). */
export type CliInput = {
    /** Written to the child's stdin, which is then closed. */
    stdin?: string | undefined;
    /** Milliseconds after which the run is killed (exit code 124). */
    timeout?: number | undefined;
};

/** The command a chain runs: `ExecAdapter` spawns the subject binary. */
export type CliPort = {
    /** Execute a command with the given arguments in the given working directory. */
    exec: (args: string, cwd: string, env?: CliEnv, input?: CliInput) => Promise<CliOutput>;

    /** Run a long-running process and wait for a pattern or timeout. */
    watch: (args: string, cwd: string, options: WatchOptions, env?: CliEnv) => Promise<CliOutput>;
};
