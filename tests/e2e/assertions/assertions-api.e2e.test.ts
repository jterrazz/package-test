import { describe, expect, test } from "vitest";

import { stripAnsi } from "../../../src/index.js";
import { dedent } from "../../setup/helpers/dedent.js";
import { runners } from "../../setup/runners.js";

describe.each(runners)("$name — api assertions", ({ spec }) => {
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
      const result = await spec("bad response").get("/users").run();
      expect(() => result.expectResponse("nonexistent.json")).toThrow("ENOENT");
    });
  });
});
