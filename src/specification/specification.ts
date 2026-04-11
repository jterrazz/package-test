import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  formatDirectoryDiff,
  formatResponseDiff,
  formatTableDiff,
} from "../infrastructure/reporter.js";
import { diffDirectories, type DirectoryDiff, walkDirectory } from "./directory.js";
import type { CommandEnv, CommandPort, CommandResult, SpawnOptions } from "./ports/command.port.js";
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

// ── File accessor ──

export interface FileAccessor {
  readonly content: string;
  readonly exists: boolean;
}

// ── Table assertion (async — vitest can't do DB queries) ──

export class TableAssertion {
  private tableName: string;
  private db: DatabasePort;

  constructor(tableName: string, db: DatabasePort) {
    this.tableName = tableName;
    this.db = db;
  }

  async toMatch(expected: { columns: string[]; rows: unknown[][] }): Promise<void> {
    const actual = await this.db.query(this.tableName, expected.columns);
    if (JSON.stringify(actual) !== JSON.stringify(expected.rows)) {
      throw new Error(formatTableDiff(this.tableName, expected.columns, expected.rows, actual));
    }
  }

  async toBeEmpty(): Promise<void> {
    const actual = await this.db.query(this.tableName, ["*"]);
    if (actual.length !== 0) {
      throw new Error(
        `Expected table "${this.tableName}" to be empty, but it has ${actual.length} rows`,
      );
    }
  }
}

// ── Directory accessor ──

export interface DirectorySnapshotOptions {
  /** Extra path segments to ignore (in addition to default: .git, node_modules, etc.). */
  ignore?: string[];
  /**
   * Force update mode regardless of vitest flags / env vars.
   * `true` writes the fixture, `false` always asserts. Defaults to auto-detect.
   */
  update?: boolean;
}

/**
 * Detect whether the user wants to update snapshots — `true` for any of:
 *   - vitest run with `-u` / `--update`
 *   - JTERRAZZ_TEST_UPDATE=1
 *   - UPDATE_SNAPSHOTS=1
 */
function shouldUpdateSnapshots(): boolean {
  if (process.env.JTERRAZZ_TEST_UPDATE === "1") {
    return true;
  }
  if (process.env.UPDATE_SNAPSHOTS === "1") {
    return true;
  }
  // Vitest sets these on its config; we read them best-effort.
  if (process.argv.includes("-u") || process.argv.includes("--update")) {
    return true;
  }
  return false;
}

export class DirectoryAccessor {
  private absPath: string;
  private testDir: string;

  constructor(absPath: string, testDir: string) {
    this.absPath = absPath;
    this.testDir = testDir;
  }

  /**
   * Compare the directory tree against `expected/{name}/` (relative to the test file).
   * On mismatch, throws with a structured diff. With update mode enabled, the
   * fixture is overwritten with the current contents instead.
   */
  async toMatchFixture(name: string, options: DirectorySnapshotOptions = {}): Promise<void> {
    const fixtureDir = resolve(this.testDir, "expected", name);
    const update = options.update ?? shouldUpdateSnapshots();

    if (update) {
      rmSync(fixtureDir, { force: true, recursive: true });
      mkdirSync(fixtureDir, { recursive: true });
      cpSync(this.absPath, fixtureDir, { recursive: true });
      return;
    }

    if (!existsSync(fixtureDir)) {
      throw new Error(
        `Directory fixture "${name}" does not exist at ${fixtureDir}.\n` +
          `Run with JTERRAZZ_TEST_UPDATE=1 (or vitest -u) to create it.`,
      );
    }

    const diff: DirectoryDiff = await diffDirectories(fixtureDir, this.absPath, {
      ignore: options.ignore,
    });

    if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
      return;
    }

    throw new Error(
      formatDirectoryDiff(name, diff, "Run with JTERRAZZ_TEST_UPDATE=1 to update the fixture."),
    );
  }

  /**
   * List all files in the directory (recursive, sorted, ignoring defaults).
   * Useful for ad-hoc assertions when you don't want a full snapshot.
   */
  async files(options: { ignore?: string[] } = {}): Promise<string[]> {
    return walkDirectory(this.absPath, options);
  }
}

// ── Response accessor ──

export class ResponseAccessor {
  readonly body: unknown;
  private testDir: string;

  constructor(body: unknown, testDir: string) {
    this.body = body;
    this.testDir = testDir;
  }

  toMatchFile(file: string): void {
    const expected = JSON.parse(readFileSync(resolve(this.testDir, "responses", file), "utf8"));
    if (JSON.stringify(this.body) !== JSON.stringify(expected)) {
      throw new Error(formatResponseDiff(file, expected, this.body));
    }
  }
}

// ── Result (after .run()) ──

export class SpecificationResult {
  private commandResult?: CommandResult;
  private config: SpecificationConfig;
  private requestInfo?: { body?: unknown; method: string; path: string };
  private responseData?: ServerResponse;
  private testDir: string;
  private workDir?: string;

  constructor(options: {
    commandResult?: CommandResult;
    config: SpecificationConfig;
    requestInfo?: { body?: unknown; method: string; path: string };
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

  // ── Raw value accessors ──

  get exitCode(): number {
    if (!this.commandResult) {
      throw new Error(".exitCode requires a CLI action (.exec())");
    }
    return this.commandResult.exitCode;
  }

  get status(): number {
    if (!this.responseData) {
      throw new Error(".status requires an HTTP action (.get(), .post(), etc.)");
    }
    return this.responseData.status;
  }

  get stdout(): string {
    if (!this.commandResult) {
      throw new Error(".stdout requires a CLI action (.exec())");
    }
    return this.commandResult.stdout;
  }

  get stderr(): string {
    if (!this.commandResult) {
      throw new Error(".stderr requires a CLI action (.exec())");
    }
    return this.commandResult.stderr;
  }

  // ── Structured accessors ──

  get response(): ResponseAccessor {
    if (!this.responseData) {
      throw new Error(".response requires an HTTP action (.get(), .post(), etc.)");
    }
    return new ResponseAccessor(this.responseData.body, this.testDir);
  }

  directory(path: string = "."): DirectoryAccessor {
    const baseDir = this.workDir ?? this.testDir;
    return new DirectoryAccessor(resolve(baseDir, path), this.testDir);
  }

  file(path: string): FileAccessor {
    const baseDir = this.workDir ?? this.testDir;
    const resolvedPath = resolve(baseDir, path);
    const exists = existsSync(resolvedPath);
    return {
      get content(): string {
        if (!exists) {
          throw new Error(`File not found: ${path}`);
        }
        return readFileSync(resolvedPath, "utf8");
      },
      exists,
    };
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
  private commandEnv: CommandEnv = {};
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

  /**
   * Set environment variables for the CLI process. Merged on top of process.env.
   * Use `null` to unset a variable. Multiple calls merge.
   *
   * The token `$WORKDIR` (in any value) is replaced with the actual working
   * directory at run-time — useful for tests that need a fully isolated `HOME`.
   *
   * @example
   *   spec("...").env({ HOME: "$WORKDIR", TZ: "UTC" }).exec("status").run();
   */
  env(env: CommandEnv): this {
    this.commandEnv = { ...this.commandEnv, ...env };
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

  private resolveEnv(workDir: string): CommandEnv | undefined {
    const keys = Object.keys(this.commandEnv);
    if (keys.length === 0) {
      return undefined;
    }

    const resolved: CommandEnv = {};
    for (const key of keys) {
      const value = this.commandEnv[key];
      resolved[key] = typeof value === "string" ? value.replace(/\$WORKDIR/g, workDir) : value;
    }
    return resolved;
  }

  private prepareWorkDir(): string {
    // Every CLI spec runs in a fresh, empty temp directory unless a project
    // Fixture is explicitly copied in via .project() (or files via .fixture()).
    // This guarantees isolation — the runner never writes into fixturesRoot.
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

    const env = this.resolveEnv(workDir);
    let commandResult: CommandResult;

    if (this.spawnConfig) {
      commandResult = await this.config.command.spawn(
        this.spawnConfig.args,
        workDir,
        this.spawnConfig.options,
        env,
      );
    } else if (Array.isArray(this.commandArgs)) {
      commandResult = { exitCode: 0, stderr: "", stdout: "" };
      for (const args of this.commandArgs) {
        commandResult = await this.config.command.exec(args, workDir, env);
        if (commandResult.exitCode !== 0) {
          break;
        }
      }
    } else {
      commandResult = await this.config.command.exec(this.commandArgs!, workDir, env);
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

export function createSpecificationRunner(config: SpecificationConfig): SpecificationRunner {
  return (label: string) => {
    const testDir = getCallerDir();
    return new SpecificationBuilder(config, testDir, label);
  };
}
