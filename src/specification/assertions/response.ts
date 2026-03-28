import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { formatResponseDiff } from "../../infrastructure/reporter.js";
import { BaseAssertion } from "./base.js";

/**
 * Assertions on an HTTP response body.
 * Usage: result.response.toMatchFile("expected.json")
 */
export class ResponseAssertion extends BaseAssertion {
  private body: unknown;
  private testDir: string;

  constructor(body: unknown, testDir: string) {
    super();
    this.body = body;
    this.testDir = testDir;
  }

  toMatchFile(file: string): void {
    const expected = JSON.parse(readFileSync(resolve(this.testDir, "responses", file), "utf8"));
    const match = JSON.stringify(this.body) === JSON.stringify(expected);
    this.assert(
      match,
      formatResponseDiff(file, expected, this.body),
      `Expected response NOT to match file "${file}", but it did`,
    );
  }

  toContain(subset: Record<string, unknown>): void {
    const bodyStr = JSON.stringify(this.body);
    const subsetStr = JSON.stringify(subset);
    // Check if all keys in subset exist with same values in body
    const bodyObj = typeof this.body === "object" && this.body !== null ? this.body : {};
    const match = Object.entries(subset).every(
      ([key, value]) =>
        JSON.stringify((bodyObj as Record<string, unknown>)[key]) === JSON.stringify(value),
    );
    this.assert(
      match,
      `Expected response to contain: ${subsetStr}\n\nActual response:\n${bodyStr}`,
      `Expected response NOT to contain: ${subsetStr}`,
    );
  }
}
