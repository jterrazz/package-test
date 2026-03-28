import { cpSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  formatExitCodeError,
  formatFileContentMismatch,
  formatFileMissing,
  formatFileUnexpected,
  formatResponseDiff,
  formatStatusError,
  formatStdoutDiff,
  formatTableDiff,
} from "../infrastructure/reporter.js";
import type { CommandPort, CommandResult, SpawnOptions } from "./ports/command.port.js";
import type { DatabasePort } from "./ports/database.port.js";
import type { ServerPort, ServerResponse } from "./ports/server.port.js";

// ── Types ──

export interface SpecificationConfig {
  command?: CommandPort;
  database?: DatabasePort;
  databases?: Map<string, DatabasePort>;
  fixturesRoot?: string;
  server?: ServerPort;
}

export interface SeedEntry {
  file: string;
  service?: string;
}

export interface FixtureEntry {
  file: string;
}

export interface MockEntry {
  file: string;
}

export interface RequestEntry {
  bodyFile?: string;
  method: string;
  path: string;
}

// ── Result (after .run()) ──

interface RequestInfo {
  body?: unknown;
  method: string;
  path: string;
}

export class SpecificationResult {
  private commandResult?: CommandResult;
  private config: SpecificationConfig;
  private requestInfo?: RequestInfo;
  private response?: ServerResponse;
  private testDir: string;
  private workDir?: string;

  constructor(options: {
    commandResult?: CommandResult;
    config: SpecificationConfig;
    requestInfo?: RequestInfo;
    response?: ServerResponse;
    testDir: string;
    workDir?: string;
  }) {
    this.response = options.response;
    this.commandResult = options.commandResult;
    this.config = options.config;
    this.testDir = options.testDir;
    this.requestInfo = options.requestInfo;
    this.workDir = options.workDir;
  }

  // ── HTTP assertions ──

  expectStatus(code: number): this {
    if (!this.response || !this.requestInfo) {
      throw new Error("expectStatus requires an HTTP action (.get(), .post(), etc.)");
    }
    if (this.response.status !== code) {
      throw new Error(
        formatStatusError(code, this.response.status, this.requestInfo, this.response.body),
      );
    }
    return this;
  }

  expectResponse(file: string): this {
    if (!this.response) {
      throw new Error("expectResponse requires an HTTP action (.get(), .post(), etc.)");
    }
    const expected = JSON.parse(readFileSync(resolve(this.testDir, "responses", file), "utf8"));
    if (JSON.stringify(this.response.body) !== JSON.stringify(expected)) {
      throw new Error(formatResponseDiff(file, expected, this.response.body));
    }
    return this;
  }

  // ── CLI assertions ──

  expectExitCode(code: number): this {
    if (!this.commandResult) {
      throw new Error("expectExitCode requires a CLI action (.exec())");
    }
    if (this.commandResult.exitCode !== code) {
      throw new Error(
        formatExitCodeError(
          code,
          this.commandResult.exitCode,
          this.commandResult.stdout,
          this.commandResult.stderr,
        ),
      );
    }
    return this;
  }

  expectStdout(file: string): this {
    if (!this.commandResult) {
      throw new Error("expectStdout requires a CLI action (.exec())");
    }
    const expected = readFileSync(resolve(this.testDir, "expected", file), "utf8").trim();
    const actual = this.commandResult.stdout.trim();
    if (actual !== expected) {
      throw new Error(formatStdoutDiff(file, expected, actual));
    }
    return this;
  }

  expectStdoutContains(str: string): this {
    if (!this.commandResult) {
      throw new Error("expectStdoutContains requires a CLI action (.exec())");
    }
    if (!this.commandResult.stdout.includes(str)) {
      throw new Error(
        `Expected stdout to contain: "${str}"\n\nActual stdout:\n${this.commandResult.stdout}`,
      );
    }
    return this;
  }

  expectStderr(file: string): this {
    if (!this.commandResult) {
      throw new Error("expectStderr requires a CLI action (.exec())");
    }
    const expected = readFileSync(resolve(this.testDir, "expected", file), "utf8").trim();
    const actual = this.commandResult.stderr.trim();
    if (actual !== expected) {
      throw new Error(formatStdoutDiff(file, expected, actual));
    }
    return this;
  }

  expectStderrContains(str: string): this {
    if (!this.commandResult) {
      throw new Error("expectStderrContains requires a CLI action (.exec())");
    }
    if (!this.commandResult.stderr.includes(str)) {
      throw new Error(
        `Expected stderr to contain: "${str}"\n\nActual stderr:\n${this.commandResult.stderr}`,
      );
    }
    return this;
  }

  // ── Cross-mode assertions ──

  async expectTable(
    table: string,
    options: { columns: string[]; rows: unknown[][]; service?: string },
  ): Promise<this> {
    const db = this.resolveDatabase(options.service);
    if (!db) {
      throw new Error(
        options.service
          ? `expectTable requires database "${options.service}" but it was not found`
          : "expectTable requires a database adapter",
      );
    }

    const actual = await db.query(table, options.columns);
    if (JSON.stringify(actual) !== JSON.stringify(options.rows)) {
      throw new Error(formatTableDiff(table, options.columns, options.rows, actual));
    }
    return this;
  }

  expectFile(path: string): this {
    const resolved = this.resolveWorkPath(path);
    if (!existsSync(resolved)) {
      throw new Error(formatFileMissing(path));
    }
    return this;
  }

  expectNoFile(path: string): this {
    const resolved = this.resolveWorkPath(path);
    if (existsSync(resolved)) {
      throw new Error(formatFileUnexpected(path));
    }
    return this;
  }

  expectFileContains(path: string, content: string): this {
    const resolved = this.resolveWorkPath(path);
    if (!existsSync(resolved)) {
      throw new Error(formatFileMissing(path));
    }
    const actual = readFileSync(resolved, "utf8");
    if (!actual.includes(content)) {
      throw new Error(formatFileContentMismatch(path, content, actual));
    }
    return this;
  }

  // ── Private ──

  private resolveDatabase(serviceName?: string): DatabasePort | undefined {
    if (serviceName && this.config.databases) {
      return this.config.databases.get(serviceName);
    }
    return this.config.database;
  }

  private resolveWorkPath(path: string): string {
    if (this.workDir) {
      return resolve(this.workDir, path);
    }
    return resolve(this.testDir, path);
  }
}

// ── Builder (before .run()) ──

export class SpecificationBuilder {
  private commandArgs: null | string | string[] = null;
  private config: SpecificationConfig;
  private fixtures: FixtureEntry[] = [];
  private label: string;
  private mocks: MockEntry[] = [];
  private projectName: null | string = null;
  private request: null | RequestEntry = null;
  private seeds: SeedEntry[] = [];
  private spawnConfig: null | { args: string; options: SpawnOptions } = null;
  private testDir: string;

  constructor(config: SpecificationConfig, testDir: string, label: string) {
    this.config = config;
    this.testDir = testDir;
    this.label = label;
  }

  // ── Setup ──

  seed(file: string, options?: { service?: string }): this {
    this.seeds.push({ file, service: options?.service });
    return this;
  }

  fixture(file: string): this {
    this.fixtures.push({ file });
    return this;
  }

  project(name: string): this {
    this.projectName = name;
    return this;
  }

  mock(file: string): this {
    this.mocks.push({ file });
    return this;
  }

  // ── HTTP actions ──

  get(path: string): this {
    this.request = { method: "GET", path };
    return this;
  }

  post(path: string, bodyFile?: string): this {
    this.request = { bodyFile, method: "POST", path };
    return this;
  }

  put(path: string, bodyFile?: string): this {
    this.request = { bodyFile, method: "PUT", path };
    return this;
  }

  delete(path: string): this {
    this.request = { method: "DELETE", path };
    return this;
  }

  // ── CLI actions ──

  exec(args: string | string[]): this {
    this.commandArgs = args;
    return this;
  }

  spawn(args: string, options: SpawnOptions): this {
    this.spawnConfig = { args, options };
    return this;
  }

  // ── Run ──

  async run(): Promise<SpecificationResult> {
    const hasHttpAction = this.request !== null;
    const hasCliAction = this.commandArgs !== null || this.spawnConfig !== null;

    if (!hasHttpAction && !hasCliAction) {
      throw new Error(
        `Specification "${this.label}": no action defined. Call .get(), .post(), .exec(), etc. before .run()`,
      );
    }

    if (hasHttpAction && hasCliAction) {
      throw new Error(
        `Specification "${this.label}": cannot mix HTTP (.get/.post) and CLI (.exec/.spawn) actions`,
      );
    }

    // Resolve working directory for CLI mode
    let workDir: null | string = null;
    if (hasCliAction) {
      workDir = this.prepareWorkDir();
    }

    // Reset all databases
    if (this.config.databases) {
      for (const db of this.config.databases.values()) {
        await db.reset();
      }
    } else if (this.config.database) {
      await this.config.database.reset();
    }

    // Execute seeds
    for (const entry of this.seeds) {
      let db: DatabasePort | undefined;
      if (entry.service && this.config.databases) {
        db = this.config.databases.get(entry.service);
        if (!db) {
          throw new Error(
            `seed() targets database "${entry.service}" but it was not found. Available: ${[...this.config.databases.keys()].join(", ")}`,
          );
        }
      } else {
        db = this.config.database;
      }

      if (!db) {
        throw new Error("seed() requires a database adapter");
      }

      const sql = readFileSync(resolve(this.testDir, "seeds", entry.file), "utf8");
      await db.seed(sql);
    }

    // Copy fixture files into working directory
    if (this.fixtures.length > 0 && workDir) {
      for (const entry of this.fixtures) {
        const src = resolve(this.testDir, "fixtures", entry.file);
        const dest = resolve(workDir, entry.file);
        cpSync(src, dest, { recursive: true });
      }
    }

    // Register MSW mocks
    for (const entry of this.mocks) {
      const _mockData = JSON.parse(readFileSync(resolve(this.testDir, "mock", entry.file), "utf8"));
      // TODO: Register MSW handler from mock data
    }

    // Execute action
    if (hasHttpAction) {
      return this.runHttpAction();
    }
    return this.runCliAction(workDir!);
  }

  // ── Private ──

  private prepareWorkDir(): string {
    const tempDir = mkdtempSync(resolve(tmpdir(), "spec-cli-"));

    if (this.projectName && this.config.fixturesRoot) {
      const projectDir = resolve(this.config.fixturesRoot, this.projectName);
      if (!existsSync(projectDir)) {
        throw new Error(
          `project("${this.projectName}"): fixture project not found at ${projectDir}`,
        );
      }
      cpSync(projectDir, tempDir, { recursive: true });
    }

    return tempDir;
  }

  private async runHttpAction(): Promise<SpecificationResult> {
    if (!this.config.server) {
      throw new Error("HTTP actions require a server adapter (use integration() or e2e())");
    }

    let body: unknown;
    if (this.request!.bodyFile) {
      body = JSON.parse(
        readFileSync(resolve(this.testDir, "requests", this.request!.bodyFile), "utf8"),
      );
    }

    const response = await this.config.server.request(
      this.request!.method,
      this.request!.path,
      body,
    );

    return new SpecificationResult({
      config: this.config,
      requestInfo: { body, method: this.request!.method, path: this.request!.path },
      response,
      testDir: this.testDir,
    });
  }

  private async runCliAction(workDir: string): Promise<SpecificationResult> {
    if (!this.config.command) {
      throw new Error("CLI actions require a command adapter (use cli())");
    }

    let commandResult: CommandResult;

    if (this.spawnConfig) {
      commandResult = await this.config.command.spawn(
        this.spawnConfig.args,
        workDir,
        this.spawnConfig.options,
      );
    } else if (Array.isArray(this.commandArgs)) {
      // Run commands sequentially in the same working directory
      commandResult = { exitCode: 0, stdout: "", stderr: "" };
      for (const args of this.commandArgs) {
        commandResult = await this.config.command.exec(args, workDir);
        if (commandResult.exitCode !== 0) {
          break;
        }
      }
    } else {
      commandResult = await this.config.command.exec(this.commandArgs!, workDir);
    }

    return new SpecificationResult({
      commandResult,
      config: this.config,
      testDir: this.testDir,
      workDir,
    });
  }
}

// ── Caller detection ──

function getCallerDir(): string {
  const stack = new Error("caller detection").stack;
  if (!stack) {
    throw new Error("Cannot detect caller directory: no stack trace");
  }

  const lines = stack.split("\n");
  for (const line of lines) {
    const match = line.match(/at\s+(?:.*?\()?(?:file:\/\/)?([^:)]+):\d+:\d+/);
    if (!match) {
      continue;
    }

    const filePath = match[1];

    if (filePath.includes("node_modules")) {
      continue;
    }
    if (filePath.includes("/src/specification/")) {
      continue;
    }

    return resolve(filePath, "..");
  }

  throw new Error("Cannot detect caller directory from stack trace");
}

// ── Factory functions ──

export type SpecificationRunner = (label: string) => SpecificationBuilder;

/**
 * Create a specification runner.
 * Automatically detects the test directory from the call site.
 */
export function createSpecificationRunner(config: SpecificationConfig): SpecificationRunner {
  return (label: string) => {
    const testDir = getCallerDir();
    return new SpecificationBuilder(config, testDir, label);
  };
}
