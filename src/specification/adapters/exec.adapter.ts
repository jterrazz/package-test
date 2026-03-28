import { execSync, spawn } from "node:child_process";

import type { CommandPort, CommandResult, SpawnOptions } from "../ports/command.port.js";

/**
 * Executes CLI commands via execSync (blocking) or spawn (long-running).
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

  async spawn(args: string, cwd: string, options: SpawnOptions): Promise<CommandResult> {
    const env = { ...process.env, INIT_CWD: undefined };

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let resolved = false;

      const child = spawn(this.command, args.split(/\s+/).filter(Boolean), {
        cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const finish = (exitCode: number) => {
        if (resolved) {
          return;
        }
        resolved = true;
        child.kill("SIGTERM");
        resolve({ exitCode, stdout, stderr });
      };

      let patternMatched = false;

      const checkPattern = () => {
        if (
          !patternMatched &&
          (stdout.includes(options.waitFor) || stderr.includes(options.waitFor))
        ) {
          patternMatched = true;
          finish(0);
        }
      };

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
        checkPattern();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
        checkPattern();
      });

      // Process exited before pattern matched
      child.on("exit", (code) => {
        if (!patternMatched) {
          finish(code === 0 ? 1 : (code ?? 1));
        }
      });

      setTimeout(() => finish(124), options.timeout);
    });
  }
}
