import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { formatStdoutDiff } from "../../infrastructure/reporter.js";
import { BaseAssertion } from "./base.js";

/**
 * Assertions on a string (stdout, stderr, response body).
 * Usage: result.stdout.toContain("hello")
 */
export class StringAssertion extends BaseAssertion {
  private actual: string;
  private label: string;
  private testDir?: string;

  constructor(actual: string, label: string, testDir?: string) {
    super();
    this.actual = actual;
    this.label = label;
    this.testDir = testDir;
  }

  toContain(expected: string, options?: { near?: string }): void {
    if (options?.near) {
      const found = this.containsNear(expected, options.near);
      this.assert(
        found,
        `Expected ${this.label} to contain "${expected}" near "${options.near}"\n\n${this.label}:\n${this.truncate(this.actual)}`,
        `Expected ${this.label} NOT to contain "${expected}" near "${options.near}", but it was found`,
      );
    } else {
      const found = this.actual.includes(expected);
      this.assert(
        found,
        `Expected ${this.label} to contain: "${expected}"\n\nActual ${this.label}:\n${this.truncate(this.actual)}`,
        `Expected ${this.label} NOT to contain: "${expected}"`,
      );
    }
  }

  toMatch(pattern: RegExp): void {
    const found = pattern.test(this.actual);
    this.assert(
      found,
      `Expected ${this.label} to match: ${pattern}\n\nActual ${this.label}:\n${this.truncate(this.actual)}`,
      `Expected ${this.label} NOT to match: ${pattern}`,
    );
  }

  toMatchFile(file: string): void {
    if (!this.testDir) {
      throw new Error("toMatchFile requires a test directory context");
    }
    const expected = readFileSync(resolve(this.testDir, "expected", file), "utf8").trim();
    const actual = this.actual.trim();
    const match = actual === expected;
    this.assert(
      match,
      formatStdoutDiff(file, expected, actual),
      `Expected ${this.label} NOT to match file "${file}", but it did`,
    );
  }

  toBeEmpty(): void {
    const empty = this.actual.trim() === "";
    this.assert(
      empty,
      `Expected ${this.label} to be empty\n\nActual ${this.label}:\n${this.truncate(this.actual)}`,
      `Expected ${this.label} NOT to be empty`,
    );
  }

  // ── Private ──

  private containsNear(target: string, near: string, proximity = 500): boolean {
    const clean = this.stripAnsi(this.actual);
    const nearLower = near.toLowerCase();
    const targetLower = target.toLowerCase();

    // Find all occurrences of `near` and check if `target` appears within proximity
    let searchFrom = 0;
    while (true) {
      const idx = clean.toLowerCase().indexOf(nearLower, searchFrom);
      if (idx === -1) {
        break;
      }
      const windowStart = Math.max(0, idx - proximity);
      const windowEnd = Math.min(clean.length, idx + nearLower.length + proximity);
      const window = clean.substring(windowStart, windowEnd).toLowerCase();
      if (window.includes(targetLower)) {
        return true;
      }
      searchFrom = idx + 1;
    }
    return false;
  }

  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, "");
  }

  private truncate(str: string, maxLines = 20): string {
    const lines = str.split("\n");
    if (lines.length <= maxLines) {
      return str;
    }
    return `${lines.slice(0, maxLines).join("\n")}\n... (${lines.length - maxLines} more lines)`;
  }
}
