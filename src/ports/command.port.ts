/**
 * Result of executing a CLI command.
 */
export interface CommandResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

/**
 * Options for spawning a long-running process.
 */
export interface SpawnOptions {
    /** Resolve when stdout/stderr contains this string. */
    waitFor: string;
    /** Kill the process after this many milliseconds. */
    timeout: number;
}

/**
 * Extra environment variables to set for the child process.
 * Values are merged on top of process.env. A `null` value unsets the variable.
 */
export type CommandEnv = Record<string, null | string>;

/**
 * Abstract CLI interface for specification runners.
 * Implement this to plug in your command execution strategy.
 */
export interface CommandPort {
    /** Execute a CLI command with the given arguments in the given working directory. */
    exec(args: string, cwd: string, env?: CommandEnv): Promise<CommandResult>;

    /** Spawn a long-running process and wait for a pattern or timeout. */
    spawn(
        args: string,
        cwd: string,
        options: SpawnOptions,
        env?: CommandEnv,
    ): Promise<CommandResult>;
}
