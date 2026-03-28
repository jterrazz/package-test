import { formatExitCodeError, formatStatusError } from "../../infrastructure/reporter.js";
import { BaseAssertion } from "./base.js";

/**
 * Assertions on a single value (exit code, status code).
 * Usage: result.exitCode.toBe(0)
 */
export class ValueAssertion extends BaseAssertion {
  private actual: number;
  private label: string;
  private context?: { request?: any; responseBody?: unknown; stdout?: string; stderr?: string };

  constructor(
    actual: number,
    label: string,
    context?: { request?: any; responseBody?: unknown; stdout?: string; stderr?: string },
  ) {
    super();
    this.actual = actual;
    this.label = label;
    this.context = context;
  }

  toBe(expected: number): void {
    const match = this.actual === expected;

    let message: string;
    if (this.label === "exit code" && this.context?.stdout !== undefined) {
      message = formatExitCodeError(
        expected,
        this.actual,
        this.context.stdout ?? "",
        this.context.stderr ?? "",
      );
    } else if (this.label === "status" && this.context?.request) {
      message = formatStatusError(
        expected,
        this.actual,
        this.context.request,
        this.context.responseBody,
      );
    } else {
      message = `Expected ${this.label}: ${expected}\nReceived ${this.label}: ${this.actual}`;
    }

    this.assert(match, message, `Expected ${this.label} NOT to be ${expected}, but it was`);
  }
}
