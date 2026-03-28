import { describe, expect, test } from "vitest";

import {
  formatResponseDiff,
  formatServiceLogs,
  formatStartupReport,
  formatStatusError,
  formatTableDiff,
  normalizeOutput,
  stripAnsi,
} from "../../../src/infrastructure/reporter.js";
import { dedent } from "../../helpers/dedent.js";

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

      expect(output).toBe(dedent`
                INFRA  Starting infrastructure...

                  ✓ postgres (db)  postgresql://test:test@localhost:PORT/test  Xms
                  ✓ redis (cache)  redis://localhost:PORT  Xms

                  → app: in-process (Hono)
            `);
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

      expect(output).toBe(dedent`
                INFRA  Starting infrastructure...

                  ✓ postgres (db)  postgresql://test:test@localhost:PORT/test  Xms

                  → app: http://localhost:PORT
            `);
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

      expect(output).toBe(dedent`
                INFRA  Starting infrastructure...

                  × postgres (db)  connection refused  Xms
                    FATAL: role "test" does not exist
                    LOG: shutting down
            `);
    });

    test("shows only last 10 log lines", () => {
      const manyLogs = Array.from({ length: 20 }, (_, i) => `log line ${i}`).join("\n");
      const expectedLogLines = Array.from({ length: 10 }, (_, i) => `    log line ${i + 10}`).join(
        "\n",
      );

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
        `INFRA  Starting infrastructure...\n\n  × postgres (db)  failed  Xms\n${expectedLogLines}`,
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

      expect(output).toBe(dedent`
                Expected status: 200
                Received status: 404

                GET /users/999

                Response:
                {
                  "error": "User not found"
                }
            `);
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

      expect(output).toBe(dedent`
                Expected status: 201
                Received status: 500

                POST /users
                {
                  "name": "Alice",
                  "email": "alice@test.com"
                }

                Response:
                {
                  "error": "Internal Server Error"
                }
            `);
    });

    test("formats without response body", () => {
      const output = stripAnsi(
        formatStatusError(200, 204, { method: "DELETE", path: "/users/1" }, null),
      );

      expect(output).toBe(dedent`
                Expected status: 200
                Received status: 204

                DELETE /users/1
            `);
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

      expect(output).toBe(dedent`
                Table "users" mismatch

                - Expected
                + Received

                  name  |  email
                - Alice  |  alice@test.com
                + Bob  |  bob@test.com
            `);
    });

    test("formats extra rows", () => {
      const output = stripAnsi(
        formatTableDiff("users", ["name"], [["Alice"]], [["Alice"], ["Bob"]]),
      );

      expect(output).toBe(dedent`
                Table "users" mismatch

                - Expected
                + Received

                  name
                  Alice
                + Bob
            `);
    });

    test("formats missing rows", () => {
      const output = stripAnsi(
        formatTableDiff("users", ["name"], [["Alice"], ["Bob"]], [["Alice"]]),
      );

      expect(output).toBe(dedent`
                Table "users" mismatch

                - Expected
                + Received

                  name
                  Alice
                - Bob
            `);
    });

    test("formats empty actual", () => {
      const output = stripAnsi(formatTableDiff("users", ["name"], [["Alice"]], []));

      expect(output).toBe(dedent`
                Table "users" mismatch

                - Expected
                + Received

                  name
                - Alice
            `);
    });

    test("formats both empty", () => {
      const output = stripAnsi(formatTableDiff("users", ["name"], [], []));

      expect(output).toBe(dedent`
                Table "users" mismatch

                - Expected
                + Received

                  name
                  (empty)
            `);
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

      expect(output).toBe(dedent`
                Response mismatch (expected.response.json)

                - Expected
                + Received

                  {
                    "user": {
                -     "name": "Alice"
                +     "name": "Bob"
                    }
                  }
            `);
    });

    test("formats nested object diff", () => {
      const output = stripAnsi(
        formatResponseDiff(
          "test.json",
          { users: [{ name: "Alice" }] },
          { users: [{ name: "Bob" }] },
        ),
      );

      expect(output).toBe(dedent`
                Response mismatch (test.json)

                - Expected
                + Received

                  {
                    "users": [
                      {
                -       "name": "Alice"
                +       "name": "Bob"
                      }
                    ]
                  }
            `);
    });
  });

  describe("service logs", () => {
    test("formats service logs", () => {
      const output = stripAnsi(
        formatServiceLogs([{ name: "postgres (db)", logs: "LOG: database ready\nLOG: listening" }]),
      );

      expect(output).toBe(
        "\npostgres (db) logs (last 10 lines):\n  LOG: database ready\n  LOG: listening",
      );
    });

    test("returns empty string for empty logs", () => {
      expect(formatServiceLogs([{ name: "redis", logs: "" }])).toBe("");
    });

    test("truncates to last 10 lines", () => {
      const logs = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
      const output = stripAnsi(formatServiceLogs([{ name: "db", logs }]));
      const expectedLines = Array.from({ length: 10 }, (_, i) => `  line ${i + 10}`).join("\n");

      expect(output).toBe(`\ndb logs (last 10 lines):\n${expectedLines}`);
    });
  });
});
