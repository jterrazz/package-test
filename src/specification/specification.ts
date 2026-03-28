import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "vitest";

import type { DatabasePort } from "./ports/database.port.js";
import type { ServerPort, ServerResponse } from "./ports/server.port.js";

// ── Types ──

export interface SpecificationConfig {
  database?: DatabasePort;
  server: ServerPort;
}

export interface SeedEntry {
  file: string;
}

export interface MockEntry {
  file: string;
}

export interface RequestEntry {
  method: string;
  path: string;
  bodyFile?: string;
}

// ── Result (after .run()) ──

interface RequestInfo {
  method: string;
  path: string;
  body?: unknown;
}

export class SpecificationResult {
  private response: ServerResponse;
  private config: SpecificationConfig;
  private testDir: string;
  private requestInfo: RequestInfo;

  constructor(
    response: ServerResponse,
    config: SpecificationConfig,
    testDir: string,
    requestInfo: RequestInfo,
  ) {
    this.response = response;
    this.config = config;
    this.testDir = testDir;
    this.requestInfo = requestInfo;
  }

  private formatContext(): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("┌ Request ────────────────────────────");
    lines.push(`│ ${this.requestInfo.method} ${this.requestInfo.path}`);
    if (this.requestInfo.body) {
      lines.push(
        `│ Body: ${JSON.stringify(this.requestInfo.body, null, 2).split("\n").join("\n│ ")}`,
      );
    }
    lines.push("└─────────────────────────────────────");

    lines.push("");
    lines.push("┌ Response ───────────────────────────");
    lines.push(`│ ${this.response.status}`);
    if (this.response.body) {
      lines.push(`│ ${JSON.stringify(this.response.body, null, 2).split("\n").join("\n│ ")}`);
    }
    lines.push("└─────────────────────────────────────");

    return lines.join("\n");
  }

  expectStatus(code: number): this {
    if (this.response.status !== code) {
      const context = this.formatContext();
      throw new Error(`Expected status ${code}, received ${this.response.status}${context}`);
    }
    return this;
  }

  expectResponse(file: string): this {
    const expected = JSON.parse(readFileSync(resolve(this.testDir, "responses", file), "utf8"));
    expect(this.response.body).toEqual(expected);
    return this;
  }

  async expectTable(
    table: string,
    options: { columns: string[]; rows: unknown[][] },
  ): Promise<this> {
    if (!this.config.database) {
      throw new Error("expectTable requires a database adapter");
    }

    const actual = await this.config.database.query(table, options.columns);
    expect(actual).toEqual(options.rows);
    return this;
  }
}

// ── Builder (before .run()) ──

export class SpecificationBuilder {
  private config: SpecificationConfig;
  private testDir: string;
  private label: string;
  private seeds: SeedEntry[] = [];
  private mocks: MockEntry[] = [];
  private request: null | RequestEntry = null;

  constructor(config: SpecificationConfig, testDir: string, label: string) {
    this.config = config;
    this.testDir = testDir;
    this.label = label;
  }

  seed(file: string): this {
    this.seeds.push({ file });
    return this;
  }

  mock(file: string): this {
    this.mocks.push({ file });
    return this;
  }

  get(path: string): this {
    this.request = { method: "GET", path };
    return this;
  }

  post(path: string, bodyFile?: string): this {
    this.request = { method: "POST", path, bodyFile };
    return this;
  }

  put(path: string, bodyFile?: string): this {
    this.request = { method: "PUT", path, bodyFile };
    return this;
  }

  delete(path: string): this {
    this.request = { method: "DELETE", path };
    return this;
  }

  async run(): Promise<SpecificationResult> {
    if (!this.request) {
      throw new Error(
        `Specification "${this.label}": no request defined. Call .get(), .post(), etc. before .run()`,
      );
    }

    // Reset database
    if (this.config.database) {
      await this.config.database.reset();
    }

    // Execute seeds
    for (const entry of this.seeds) {
      if (!this.config.database) {
        throw new Error("seed() requires a database adapter");
      }

      const sql = readFileSync(resolve(this.testDir, "seeds", entry.file), "utf8");
      await this.config.database.seed(sql);
    }

    // Register MSW mocks
    for (const entry of this.mocks) {
      const _mockData = JSON.parse(readFileSync(resolve(this.testDir, "mock", entry.file), "utf8"));
      // TODO: Register MSW handler from mock data
      // The mock file format and MSW integration will be designed
      // When the first project needs it
    }

    // Execute request
    let body: unknown;
    if (this.request.bodyFile) {
      body = JSON.parse(
        readFileSync(resolve(this.testDir, "requests", this.request.bodyFile), "utf8"),
      );
    }

    const response = await this.config.server.request(this.request.method, this.request.path, body);

    return new SpecificationResult(response, this.config, this.testDir, {
      method: this.request.method,
      path: this.request.path,
      body,
    });
  }
}

// ── Caller detection ──

function getCallerDir(): string {
  const stack = new Error("caller detection").stack;
  if (!stack) {
    throw new Error("Cannot detect caller directory: no stack trace");
  }

  // Find the first stack frame that is a user test file
  // (not in node_modules, not this file)
  const lines = stack.split("\n");
  for (const line of lines) {
    // Match both "at path:line:col" and "at func (file://path:line:col)"
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
