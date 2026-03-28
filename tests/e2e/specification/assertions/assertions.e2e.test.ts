import { describe, expect, test } from "vitest";

import { stripAnsi } from "../../../../src/index.js";
import { dedent } from "../../../helpers/dedent.js";
import { runners } from "../../../setup/runners.js";

describe.each(runners)("$name — assertions", ({ spec }) => {
  describe("expectStatus", () => {
    test("passes on correct status", async () => {
      const result = await spec("correct status").seed("two-users.sql").get("/users").run();
      result.expectStatus(200);
    });

    test("fails with formatted error on wrong status", async () => {
      // Given — request to non-existent resource
      const result = await spec("wrong status").get("/users/999").run();

      // Then — error shows expected/received + request/response context
      try {
        result.expectStatus(200);
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(dedent`
                    Expected status: 200
                    Received status: 404

                    GET /users/999

                    Response:
                    {
                      "error": "User not found"
                    }
                `);
      }
    });
  });

  describe("expectResponse", () => {
    test("passes when body matches file", async () => {
      const result = await spec("matching body").seed("two-users.sql").get("/users").run();
      result.expectResponse("all-users.response.json");
    });

    test("fails with diff on body mismatch", async () => {
      // Given — response differs from expected file
      const result = await spec("wrong body").seed("two-users.sql").get("/users").run();

      // Then — error shows line-by-line JSON diff
      try {
        result.expectResponse("wrong-body.response.json");
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(dedent`
                    Response mismatch (wrong-body.response.json)

                    - Expected
                    + Received

                      {
                        "users": [
                          {
                    -       "name": "Wrong1",
                    +       "name": "Alice",
                    -       "email": "wrong1@test.com"
                    +       "email": "alice@test.com"
                          },
                          {
                    -       "name": "Wrong2",
                    +       "name": "Bob",
                    -       "email": "wrong2@test.com"
                    +       "email": "bob@test.com"
                          }
                        ]
                      }
                `);
      }
    });
  });

  describe("expectTable", () => {
    test("passes when rows match", async () => {
      const result = await spec("matching rows").seed("one-user.sql").get("/users").run();
      await result.expectTable("users", {
        columns: ["name", "email"],
        rows: [["Alice", "alice@test.com"]],
      });
    });

    test("fails with diff on wrong row values", async () => {
      // Given — actual rows differ from expected
      const result = await spec("wrong values").seed("one-user.sql").get("/users").run();

      // Then — error shows query context + +/- diff per row
      try {
        await result.expectTable("users", { columns: ["name"], rows: [["NonExistent"]] });
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(dedent`
                    Table "users" mismatch
                      query: name
                      expected: 1 row
                      received: 1 row

                    - Expected
                    + Received

                      name
                    - NonExistent
                    + Alice
                `);
      }
    });

    test("fails with diff on extra rows", async () => {
      // Given — table has more rows than expected
      const result = await spec("extra rows").seed("two-users.sql").get("/users").run();

      // Then — row count mismatch + extra rows with + marker
      try {
        await result.expectTable("users", { columns: ["name"], rows: [["Alice"]] });
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(dedent`
                    Table "users" mismatch
                      query: name
                      expected: 1 row
                      received: 2 rows

                    - Expected
                    + Received

                      name
                      Alice
                    + Bob
                `);
      }
    });

    test("fails with diff on missing rows", async () => {
      // Given — empty table, expecting rows
      const result = await spec("missing rows").get("/users").run();

      // Then — row count mismatch + missing rows with - marker
      try {
        await result.expectTable("users", { columns: ["name"], rows: [["Alice"]] });
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(dedent`
                    Table "users" mismatch
                      query: name
                      expected: 1 row
                      received: 0 rows

                    - Expected
                    + Received

                      name
                    - Alice
                `);
      }
    });
  });
});
