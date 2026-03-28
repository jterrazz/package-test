import { describe, expect, test } from "vitest";

import {
  formatResponseDiff,
  formatServiceLogs,
  formatStartupReport,
  formatStatusError,
  formatTableDiff,
  normalizeOutput,
  stripAnsi,
} from "../../../../src/infrastructure/reporter.js";

describe("output formatting", () => {
  describe("startup report", () => {
    test("formats successful integration startup", () => {
      const output = normalizeOutput(
        formatStartupReport(
          "integration",
          [
            {
              name: "db",
              type: "postgres",
              connectionString: "postgresql://test:test@localhost:54321/test",
              durationMs: 420,
            },
            {
              name: "cache",
              type: "redis",
              connectionString: "redis://localhost:63791",
              durationMs: 180,
            },
          ],
          { type: "in-process" },
        ),
      );

      expect(output).toBe(
        [
          "INFRA  Starting infrastructure...",
          "",
          "  ✓ postgres (db)  postgresql://test:test@localhost:PORT/test  Xms",
          "  ✓ redis (cache)  redis://localhost:PORT  Xms",
          "",
          "  → app: in-process (Hono)",
        ].join("\n"),
      );
    });

    test("formats successful e2e startup", () => {
      const output = normalizeOutput(
        formatStartupReport(
          "e2e",
          [
            {
              name: "db",
              type: "postgres",
              connectionString: "postgresql://test:test@localhost:5432/test",
              durationMs: 2100,
            },
          ],
          { type: "http", url: "http://localhost:3000" },
        ),
      );

      expect(output).toContain("INFRA  Starting infrastructure...");
      expect(output).toContain("✓ postgres (db)");
      expect(output).toContain("→ app: http://localhost:PORT");
    });

    test("formats failed startup with error and logs", () => {
      const output = normalizeOutput(
        formatStartupReport("integration", [
          {
            name: "db",
            type: "postgres",
            durationMs: 180,
            error: "connection refused",
            logs: 'FATAL: role "test" does not exist\nLOG: shutting down',
          },
        ]),
      );

      expect(output).toContain("× postgres (db)");
      expect(output).toContain("connection refused");
      expect(output).toContain('FATAL: role "test" does not exist');
      expect(output).toContain("LOG: shutting down");
    });

    test("shows only last 10 log lines", () => {
      const manyLogs = Array.from({ length: 20 }, (_, i) => `log line ${i}`).join("\n");

      const output = stripAnsi(
        formatStartupReport("integration", [
          {
            name: "db",
            type: "postgres",
            durationMs: 100,
            error: "failed",
            logs: manyLogs,
          },
        ]),
      );

      expect(output).not.toContain("log line 0");
      expect(output).not.toContain("log line 9");
      expect(output).toContain("log line 10");
      expect(output).toContain("log line 19");
    });
  });

  describe("status error", () => {
    test("formats GET failure", () => {
      const output = stripAnsi(
        formatStatusError(
          200,
          404,
          { method: "GET", path: "/users/999" },
          {
            error: "User not found",
          },
        ),
      );

      expect(output).toBe(
        [
          "Expected status: 200",
          "Received status: 404",
          "",
          "GET /users/999",
          "",
          "Response:",
          "{",
          '  "error": "User not found"',
          "}",
        ].join("\n"),
      );
    });

    test("formats POST failure with request body", () => {
      const output = stripAnsi(
        formatStatusError(
          201,
          500,
          {
            method: "POST",
            path: "/users",
            body: { name: "Alice", email: "alice@test.com" },
          },
          { error: "Internal Server Error" },
        ),
      );

      expect(output).toContain("Expected status: 201");
      expect(output).toContain("Received status: 500");
      expect(output).toContain("POST /users");
      expect(output).toContain('"name": "Alice"');
      expect(output).toContain('"email": "alice@test.com"');
      expect(output).toContain("Response:");
      expect(output).toContain("Internal Server Error");
    });

    test("formats without response body", () => {
      const output = stripAnsi(
        formatStatusError(200, 204, { method: "DELETE", path: "/users/1" }, null),
      );

      expect(output).toContain("Expected status: 200");
      expect(output).toContain("Received status: 204");
      expect(output).toContain("DELETE /users/1");
      expect(output).not.toContain("Response:");
    });
  });

  describe("table diff", () => {
    test("formats row mismatch with +/- markers", () => {
      const output = stripAnsi(
        formatTableDiff(
          "users",
          ["name", "email"],
          [["Alice", "alice@test.com"]],
          [["Bob", "bob@test.com"]],
        ),
      );

      expect(output).toBe(
        [
          'Table "users" mismatch',
          "",
          "- Expected",
          "+ Received",
          "",
          "  name  |  email",
          "- Alice  |  alice@test.com",
          "+ Bob  |  bob@test.com",
        ].join("\n"),
      );
    });

    test("formats extra rows", () => {
      const output = stripAnsi(
        formatTableDiff("users", ["name"], [["Alice"]], [["Alice"], ["Bob"]]),
      );

      expect(output).toContain("  Alice");
      expect(output).toContain("+ Bob");
    });

    test("formats missing rows", () => {
      const output = stripAnsi(
        formatTableDiff("users", ["name"], [["Alice"], ["Bob"]], [["Alice"]]),
      );

      expect(output).toContain("  Alice");
      expect(output).toContain("- Bob");
    });

    test("formats empty actual", () => {
      const output = stripAnsi(formatTableDiff("users", ["name"], [["Alice"]], []));

      expect(output).toContain("- Alice");
    });

    test("formats both empty", () => {
      const output = stripAnsi(formatTableDiff("users", ["name"], [], []));

      expect(output).toContain("(empty)");
    });
  });

  describe("response diff", () => {
    test("formats JSON diff line by line", () => {
      const output = stripAnsi(
        formatResponseDiff(
          "expected.response.json",
          { user: { name: "Alice" } },
          { user: { name: "Bob" } },
        ),
      );

      expect(output).toContain("Response mismatch (expected.response.json)");
      expect(output).toContain("- Expected");
      expect(output).toContain("+ Received");
      expect(output).toContain('-     "name": "Alice"');
      expect(output).toContain('+     "name": "Bob"');
    });

    test("shows matching lines without markers", () => {
      const output = stripAnsi(
        formatResponseDiff(
          "test.json",
          { users: [{ name: "Alice" }] },
          { users: [{ name: "Bob" }] },
        ),
      );

      // The "users": [ line should match (no +/-)
      expect(output).toContain('  "users": [');
    });
  });

  describe("service logs", () => {
    test("formats service logs", () => {
      const output = stripAnsi(
        formatServiceLogs([{ name: "postgres (db)", logs: "LOG: database ready\nLOG: listening" }]),
      );

      expect(output).toContain("postgres (db) logs (last 10 lines):");
      expect(output).toContain("  LOG: database ready");
      expect(output).toContain("  LOG: listening");
    });

    test("skips empty logs", () => {
      const output = formatServiceLogs([{ name: "redis", logs: "" }]);

      expect(output).toBe("");
    });

    test("truncates to last 10 lines", () => {
      const logs = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
      const output = stripAnsi(formatServiceLogs([{ name: "db", logs }]));

      expect(output).not.toContain("line 9");
      expect(output).toContain("line 10");
      expect(output).toContain("line 19");
    });
  });
});
