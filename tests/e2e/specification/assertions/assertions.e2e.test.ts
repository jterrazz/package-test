import { describe, expect, test } from "vitest";

import { stripAnsi } from "../../../../src/index.js";
import { runners } from "../../../setup/runners.js";

describe.each(runners)("$name — assertions", ({ spec }) => {
  describe("expectStatus", () => {
    test("passes on correct status", async () => {
      const result = await spec("correct status").seed("two-users.sql").get("/users").run();

      result.expectStatus(200);
    });

    test("fails with formatted error on wrong status", async () => {
      const result = await spec("wrong status").get("/users/999").run();

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
    test("passes when body matches file", async () => {
      const result = await spec("matching body").seed("two-users.sql").get("/users").run();

      result.expectResponse("all-users.response.json");
    });

    test("fails with diff on body mismatch", async () => {
      const result = await spec("wrong body").seed("two-users.sql").get("/users").run();

      try {
        result.expectResponse("wrong-body.response.json");
        expect.fail("should have thrown");
      } catch (error: any) {
        const msg = stripAnsi(error.message);
        expect(msg).toBe(
          [
            "Response mismatch (wrong-body.response.json)",
            "",
            "- Expected",
            "+ Received",
            "",
            "  {",
            '    "users": [',
            "      {",
            '-       "name": "Wrong1",',
            '+       "name": "Alice",',
            '-       "email": "wrong1@test.com"',
            '+       "email": "alice@test.com"',
            "      },",
            "      {",
            '-       "name": "Wrong2",',
            '+       "name": "Bob",',
            '-       "email": "wrong2@test.com"',
            '+       "email": "bob@test.com"',
            "      }",
            "    ]",
            "  }",
          ].join("\n"),
        );
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
      const result = await spec("wrong values").seed("one-user.sql").get("/users").run();

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

    test("fails with diff on extra rows", async () => {
      const result = await spec("extra rows").seed("two-users.sql").get("/users").run();

      try {
        await result.expectTable("users", {
          columns: ["name"],
          rows: [["Alice"]],
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
            "  Alice",
            "+ Bob",
          ].join("\n"),
        );
      }
    });

    test("fails with diff on missing rows", async () => {
      const result = await spec("missing rows").get("/users").run();

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
