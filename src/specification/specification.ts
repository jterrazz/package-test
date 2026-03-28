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

export class SpecificationResult {
  private response: ServerResponse;
  private config: SpecificationConfig;
  private testDir: string;

  constructor(response: ServerResponse, config: SpecificationConfig, testDir: string) {
    this.response = response;
    this.config = config;
    this.testDir = testDir;
  }

  expectStatus(code: number): this {
    expect(this.response.status).toBe(code);
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

    return new SpecificationResult(response, this.config, this.testDir);
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
    if (filePath.includes("/specification/")) {
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
