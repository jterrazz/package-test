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

      expect(output).toBe(
        [
          "INFRA  Starting infrastructure...",
          "",
          "  ✓ postgres (db)  postgresql://test:test@localhost:PORT/test  Xms",
          "",
          "  → app: http://localhost:PORT",
        ].join("\n"),
      );
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

      expect(output).toBe(
        [
          "INFRA  Starting infrastructure...",
          "",
          "  × postgres (db)  connection refused  Xms",
          '    FATAL: role "test" does not exist',
          "    LOG: shutting down",
        ].join("\n"),
      );
    });

    test("shows only last 10 log lines", () => {
      const manyLogs = Array.from({ length: 20 }, (_, i) => `log line ${i}`).join("\n");

      const output = normalizeOutput(
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

      expect(output).toBe(
        [
          "INFRA  Starting infrastructure...",
          "",
          "  × postgres (db)  failed  Xms",
          ...Array.from({ length: 10 }, (_, i) => `    log line ${i + 10}`),
        ].join("\n"),
      );
    });
  });

  describe("status error", () => {
    test("formats GET failure", () => {
      const output = stripAnsi(
        formatStatusError(
          200,
          404,
          { method: "GET", path: "/users/999" },
          { error: "User not found" },
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
          { method: "POST", path: "/users", body: { name: "Alice", email: "alice@test.com" } },
          { error: "Internal Server Error" },
        ),
      );

      expect(output).toBe(
        [
          "Expected status: 201",
          "Received status: 500",
          "",
          "POST /users",
          "{",
          '  "name": "Alice",',
          '  "email": "alice@test.com"',
          "}",
          "",
          "Response:",
          "{",
          '  "error": "Internal Server Error"',
          "}",
        ].join("\n"),
      );
    });

    test("formats without response body", () => {
      const output = stripAnsi(
        formatStatusError(200, 204, { method: "DELETE", path: "/users/1" }, null),
      );

      expect(output).toBe(
        ["Expected status: 200", "Received status: 204", "", "DELETE /users/1"].join("\n"),
      );
    });
  });

  describe("table diff", () => {
    test("formats row mismatch", () => {
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

      expect(output).toBe(
        [
          'Table "users" mismatch',
          "",
          "- Expected",
          "+ Received",
          "",
          "  name",
          "  Alice",
          "+ Bob",
        ].join("\n"),
      );
    });

    test("formats missing rows", () => {
      const output = stripAnsi(
        formatTableDiff("users", ["name"], [["Alice"], ["Bob"]], [["Alice"]]),
      );

      expect(output).toBe(
        [
          'Table "users" mismatch',
          "",
          "- Expected",
          "+ Received",
          "",
          "  name",
          "  Alice",
          "- Bob",
        ].join("\n"),
      );
    });

    test("formats empty actual", () => {
      const output = stripAnsi(formatTableDiff("users", ["name"], [["Alice"]], []));

      expect(output).toBe(
        ['Table "users" mismatch', "", "- Expected", "+ Received", "", "  name", "- Alice"].join(
          "\n",
        ),
      );
    });

    test("formats both empty", () => {
      const output = stripAnsi(formatTableDiff("users", ["name"], [], []));

      expect(output).toBe(
        ['Table "users" mismatch', "", "- Expected", "+ Received", "", "  name", "  (empty)"].join(
          "\n",
        ),
      );
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

      expect(output).toBe(
        [
          "Response mismatch (expected.response.json)",
          "",
          "- Expected",
          "+ Received",
          "",
          "  {",
          '    "user": {',
          '-     "name": "Alice"',
          '+     "name": "Bob"',
          "    }",
          "  }",
        ].join("\n"),
      );
    });

    test("formats nested object diff", () => {
      const output = stripAnsi(
        formatResponseDiff(
          "test.json",
          { users: [{ name: "Alice" }] },
          { users: [{ name: "Bob" }] },
        ),
      );

      expect(output).toBe(
        [
          "Response mismatch (test.json)",
          "",
          "- Expected",
          "+ Received",
          "",
          "  {",
          '    "users": [',
          "      {",
          '-       "name": "Alice"',
          '+       "name": "Bob"',
          "      }",
          "    ]",
          "  }",
        ].join("\n"),
      );
    });
  });

  describe("service logs", () => {
    test("formats service logs", () => {
      const output = stripAnsi(
        formatServiceLogs([{ name: "postgres (db)", logs: "LOG: database ready\nLOG: listening" }]),
      );

      expect(output).toBe(
        [
          "",
          "postgres (db) logs (last 10 lines):",
          "  LOG: database ready",
          "  LOG: listening",
        ].join("\n"),
      );
    });

    test("returns empty string for empty logs", () => {
      expect(formatServiceLogs([{ name: "redis", logs: "" }])).toBe("");
    });

    test("truncates to last 10 lines", () => {
      const logs = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
      const output = stripAnsi(formatServiceLogs([{ name: "db", logs }]));

      expect(output).toBe(
        [
          "",
          "db logs (last 10 lines):",
          ...Array.from({ length: 10 }, (_, i) => `  line ${i + 10}`),
        ].join("\n"),
      );
    });
  });
});
