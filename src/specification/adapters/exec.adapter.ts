import { execSync } from "node:child_process";

import type { CommandPort, CommandResult } from "../ports/command.port.js";

/**
 * Executes CLI commands via execSync.
 * Used by cli() for local command execution.
 */
export class ExecAdapter implements CommandPort {
  private command: string;

  constructor(command: string) {
    this.command = command;
  }

  async exec(args: string, cwd: string): Promise<CommandResult> {
    // Clear INIT_CWD so CLI tools use the actual cwd, not npm's caller directory
    const env = { ...process.env, INIT_CWD: undefined };

    try {
      const stdout = execSync(`${this.command} ${args}`, {
        cwd,
        encoding: "utf8",
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { exitCode: 0, stdout, stderr: "" };
    } catch (error: any) {
      return {
        exitCode: error.status ?? 1,
        stdout: error.stdout?.toString() ?? "",
        stderr: error.stderr?.toString() ?? "",
      };
    }
  }
}
