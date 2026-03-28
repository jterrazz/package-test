/**
 * Result of executing a CLI command.
 */
export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Abstract CLI interface for specification runners.
 * Implement this to plug in your command execution strategy.
 */
export interface CommandPort {
  /** Execute a CLI command with the given arguments in the given working directory. */
  exec(args: string, cwd: string): Promise<CommandResult>;
}
