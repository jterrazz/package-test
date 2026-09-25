import type { CliOutput } from '../../../expectations/command/cli.result.js';
import type { EnvRecord } from '../../../kernel/context/with.capability.js';

export type { CliOutput } from '../../../expectations/command/cli.result.js';

/** The long-running form of `.exec()` (B2): resolves when `waitFor` appears, killed at `timeout` (exit 124). */
export type ExecOptions = {
    /** Resolve (exit code 0) when stdout/stderr contains this string. */
    waitFor?: string | undefined;
    /** Kill the process after this many milliseconds. Defaults to 10 000. */
    timeout?: number | undefined;
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
    watch: (args: string, cwd: string, options: ExecOptions, env?: CliEnv) => Promise<CliOutput>;
};
