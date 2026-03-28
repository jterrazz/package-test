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

    test("fails with GET context on wrong status", async () => {
      // Given — request to non-existent resource
      const result = await spec("wrong status GET").get("/users/999").run();

      // Then — error shows method, path, response body
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

    test("fails with POST context including request body", async () => {
      // Given — POST that succeeds but we expect failure
      const result = await spec("wrong status POST").post("/users", "create-user.json").run();

      // Then — error includes request body + response body
      try {
        result.expectStatus(500);
        expect.fail("should have thrown");
      } catch (error: any) {
        const msg = stripAnsi(error.message);
        expect(msg).toBe(dedent`
                    Expected status: 500
                    Received status: 201

                    POST /users
                    {
                      "name": "Charlie",
                      "email": "charlie@test.com"
                    }

                    Response:
                    {
                      "user": {
                        "name": "Charlie",
                        "email": "charlie@test.com"
                      }
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

    test("fails with line-by-line JSON diff", async () => {
      // Given — response differs from expected file
      const result = await spec("wrong body").seed("two-users.sql").get("/users").run();

      // Then — error shows file name + -/+ diff
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

    test("throws on nonexistent response file", async () => {
      // Given — valid request
      const result = await spec("bad response").get("/users").run();

      // Then — ENOENT error
      expect(() => result.expectResponse("nonexistent.json")).toThrow("ENOENT");
    });
  });

  describe("expectTable", () => {
    test("passes on single column match", async () => {
      const result = await spec("single col").seed("one-user.sql").get("/users").run();
      await result.expectTable("users", {
        columns: ["name"],
        rows: [["Alice"]],
      });
    });

    test("passes on multi-column match", async () => {
      const result = await spec("multi col").seed("one-user.sql").get("/users").run();
      await result.expectTable("users", {
        columns: ["name", "email"],
        rows: [["Alice", "alice@test.com"]],
      });
    });

    test("fails with multi-column diff", async () => {
      // Given — two users in table, expecting wrong values
      const result = await spec("multi col diff").seed("two-users.sql").get("/users").run();

      // Then — error shows both columns in diff
      try {
        await result.expectTable("users", {
          columns: ["name", "email"],
          rows: [
            ["Wrong1", "wrong1@test.com"],
            ["Wrong2", "wrong2@test.com"],
          ],
        });
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(dedent`
                    Table "users" mismatch
                      query: name, email
                      expected: 2 rows
                      received: 2 rows

                    - Expected
                    + Received

                      name  |  email
                    - Wrong1  |  wrong1@test.com
                    + Alice  |  alice@test.com
                    - Wrong2  |  wrong2@test.com
                    + Bob  |  bob@test.com
                `);
      }
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
