import { cpSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { FileAssertion } from "./assertions/file.js";
import { ResponseAssertion } from "./assertions/response.js";
import { StringAssertion } from "./assertions/string.js";
import { TableAssertion } from "./assertions/table.js";
import { ValueAssertion } from "./assertions/value.js";
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
  private responseData?: ServerResponse;
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
    this.responseData = options.response;
    this.commandResult = options.commandResult;
    this.config = options.config;
    this.testDir = options.testDir;
    this.requestInfo = options.requestInfo;
    this.workDir = options.workDir;
  }

  // ── Scoped assertion accessors ──

  get exitCode(): ValueAssertion {
    if (!this.commandResult) {
      throw new Error(".exitCode requires a CLI action (.exec())");
    }
    return new ValueAssertion(this.commandResult.exitCode, "exit code", {
      stderr: this.commandResult.stderr,
      stdout: this.commandResult.stdout,
    });
  }

  get status(): ValueAssertion {
    if (!this.responseData || !this.requestInfo) {
      throw new Error(".status requires an HTTP action (.get(), .post(), etc.)");
    }
    return new ValueAssertion(this.responseData.status, "status", {
      request: this.requestInfo,
      responseBody: this.responseData.body,
    });
  }

  get response(): ResponseAssertion {
    if (!this.responseData) {
      throw new Error(".response requires an HTTP action (.get(), .post(), etc.)");
    }
    return new ResponseAssertion(this.responseData.body, this.testDir);
  }

  get stdout(): StringAssertion {
    if (!this.commandResult) {
      throw new Error(".stdout requires a CLI action (.exec())");
    }
    return new StringAssertion(this.commandResult.stdout, "stdout", this.testDir);
  }

  get stderr(): StringAssertion {
    if (!this.commandResult) {
      throw new Error(".stderr requires a CLI action (.exec())");
    }
    return new StringAssertion(this.commandResult.stderr, "stderr", this.testDir);
  }

  file(path: string): FileAssertion {
    const baseDir = this.workDir ?? this.testDir;
    return new FileAssertion(path, baseDir);
  }

  table(tableName: string, options?: { service?: string }): TableAssertion {
    const db = this.resolveDatabase(options?.service);
    if (!db) {
      throw new Error(
        options?.service
          ? `table("${tableName}") requires database "${options.service}" but it was not found`
          : `table("${tableName}") requires a database adapter`,
      );
    }
    return new TableAssertion(tableName, db);
  }

  // ── Private ──

  private resolveDatabase(serviceName?: string): DatabasePort | undefined {
    if (serviceName && this.config.databases) {
      return this.config.databases.get(serviceName);
    }
    return this.config.database;
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
    // No project or fixtures — run from fixturesRoot or cwd (no temp dir needed)
    if (!this.projectName && this.fixtures.length === 0) {
      return this.config.fixturesRoot ?? process.cwd();
    }

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
