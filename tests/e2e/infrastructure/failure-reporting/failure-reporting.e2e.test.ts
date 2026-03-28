import { describe, expect, test } from "vitest";

import { stripAnsi } from "../../../../src/index.js";
import { integrationSpec } from "../../../setup/integration.specification.js";

describe("failure reporting", () => {
  const spec = integrationSpec;

  describe("expectStatus", () => {
    test("shows full context on POST status mismatch", async () => {
      const result = await spec("status POST context")
        .seed("one-user.sql")
        .post("/users", "create-user.json")
        .run();

      try {
        result.expectStatus(500);
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(
          [
            "Expected status: 500",
            "Received status: 201",
            "",
            "POST /users",
            "{",
            '  "name": "Charlie",',
            '  "email": "charlie@test.com"',
            "}",
            "",
            "Response:",
            "{",
            '  "user": {',
            '    "name": "Charlie",',
            '    "email": "charlie@test.com"',
            "  }",
            "}",
          ].join("\n"),
        );
      }
    });

    test("shows context on GET 404 mismatch", async () => {
      const result = await spec("status GET context").get("/users/999").run();

      try {
        result.expectStatus(200);
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(
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
      }
    });
  });

  describe("expectResponse", () => {
    test("shows diff on response mismatch", async () => {
      const result = await spec("response mismatch").seed("one-user.sql").get("/users").run();

      try {
        result.expectResponse("wrong.response.json");
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(
          [
            "Response mismatch (wrong.response.json)",
            "",
            "- Expected",
            "+ Received",
            "",
            "  {",
            '    "users": [',
            "      {",
            '-       "name": "Wrong",',
            '+       "name": "Alice",',
            '-       "email": "wrong@test.com"',
            '+       "email": "alice@test.com"',
            "      }",
            "    ]",
            "  }",
          ].join("\n"),
        );
      }
    });
  });

  describe("expectTable", () => {
    test("shows diff on table mismatch", async () => {
      const result = await spec("table mismatch").seed("one-user.sql").get("/users").run();

      try {
        await result.expectTable("users", {
          columns: ["name"],
          rows: [["NonExistent"]],
        });
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(
          [
            'Table "users" mismatch',
            "",
            "- Expected",
            "+ Received",
            "",
            "  name",
            "- NonExistent",
            "+ Alice",
          ].join("\n"),
        );
      }
    });

    test("shows diff on empty actual", async () => {
      const result = await spec("table empty").get("/users").run();

      try {
        await result.expectTable("users", {
          columns: ["name"],
          rows: [["Alice"]],
        });
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toBe(
          ['Table "users" mismatch', "", "- Expected", "+ Received", "", "  name", "- Alice"].join(
            "\n",
          ),
        );
      }
    });
  });
});
