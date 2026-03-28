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
 * Abstract CLI interface for specification runners.
 * Implement this to plug in your command execution strategy.
 */
export interface CommandPort {
  /** Execute a CLI command with the given arguments in the given working directory. */
  exec(args: string, cwd: string): Promise<CommandResult>;

  /** Spawn a long-running process and wait for a pattern or timeout. */
  spawn(args: string, cwd: string, options: SpawnOptions): Promise<CommandResult>;
}
