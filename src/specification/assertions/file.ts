import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  formatFileContentMismatch,
  formatFileMissing,
  formatFileUnexpected,
} from "../../infrastructure/reporter.js";
import { BaseAssertion } from "./base.js";

/**
 * Assertions on a file in the working directory.
 * Usage: result.file("dist/index.js").toExist()
 */
export class FileAssertion extends BaseAssertion {
  private filePath: string;
  private resolvedPath: string;

  constructor(filePath: string, workDir: string) {
    super();
    this.filePath = filePath;
    this.resolvedPath = resolve(workDir, filePath);
  }

  toExist(): void {
    const exists = existsSync(this.resolvedPath);
    this.assert(exists, formatFileMissing(this.filePath), formatFileUnexpected(this.filePath));
  }

  toContain(expected: string): void {
    if (!existsSync(this.resolvedPath)) {
      if (this.negated) {
        return; // File doesn't exist, so it certainly doesn't contain the string
      }
      throw new Error(formatFileMissing(this.filePath));
    }
    const content = readFileSync(this.resolvedPath, "utf8");
    const found = content.includes(expected);
    this.assert(
      found,
      formatFileContentMismatch(this.filePath, expected, content),
      `Expected file "${this.filePath}" NOT to contain "${expected}"`,
    );
  }

  toMatch(pattern: RegExp): void {
    if (!existsSync(this.resolvedPath)) {
      if (this.negated) {
        return;
      }
      throw new Error(formatFileMissing(this.filePath));
    }
    const content = readFileSync(this.resolvedPath, "utf8");
    const found = pattern.test(content);
    this.assert(
      found,
      `Expected file "${this.filePath}" to match: ${pattern}\n\nActual content:\n${content.slice(0, 500)}`,
      `Expected file "${this.filePath}" NOT to match: ${pattern}`,
    );
  }
}
