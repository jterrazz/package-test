/**
 * Raw output from a command execution, including exit code and captured output streams.
 */
export interface CliOutput {
    /** Process exit code (0 = success). */
    exitCode: number;
    /** Captured standard output. */
    stdout: string;
    /** Captured standard error. */
    stderr: string;
}

/**
 * Options for the long-running form of `.exec()` (CONVENTIONS B2). When
 * either option is present the process is spawned and observed: it resolves
 * as soon as `waitFor` appears in stdout/stderr, and is killed when `timeout`
 * elapses (exit code 124).
 */
export interface ExecOptions {
    /** Resolve (exit code 0) when stdout/stderr contains this string. */
    waitFor?: string;
    /** Kill the process after this many milliseconds. Defaults to 10 000. */
    timeout?: number;
}

/**
 * Extra environment variables to set for the child process.
 * Values are merged on top of process.env. A `null` value unsets the variable.
 */
export type CliEnv = Record<string, null | string>;

/**
 * Abstract command interface for specification runners.
 * Implement this to plug in your command execution strategy.
 */
/**
 * What one invocation is handed beyond its arguments — the two per-run inputs a
 * spec document may state. Both are absent by default: the child gets an
 * immediately-closed stdin (never a TTY) and the adapter's own timeout.
 */
export interface CliInput {
    /** Written to the child's stdin, which is then closed. */
    stdin?: string;
    /** Milliseconds after which the run is killed (exit code 124). */
    timeout?: number;
}

export interface CliPort {
    /** Execute a command with the given arguments in the given working directory. */
    exec: (args: string, cwd: string, env?: CliEnv, input?: CliInput) => Promise<CliOutput>;

    /** Run a long-running process and wait for a pattern or timeout. */
    watch: (args: string, cwd: string, options: ExecOptions, env?: CliEnv) => Promise<CliOutput>;
}
