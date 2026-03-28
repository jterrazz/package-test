import { describe, expect, test } from "vitest";

import { runners } from "../../setup/runners.js";

describe.each(runners)("$name — assertions", ({ spec }) => {
  describe("expectStatus", () => {
    test("passes on correct status", async () => {
      const result = await spec("correct status").seed("two-users.sql").get("/users").run();

      result.expectStatus(200);
    });

    test("fails on wrong status", async () => {
      const result = await spec("wrong status").get("/users/999").run();

      expect(() => result.expectStatus(200)).toThrow();
    });
  });

  describe("expectResponse", () => {
    test("passes when body matches file", async () => {
      const result = await spec("matching body").seed("two-users.sql").get("/users").run();

      result.expectResponse("all-users.response.json");
    });

    test("fails when body differs from file", async () => {
      const result = await spec("wrong body").seed("two-users.sql").get("/users").run();

      expect(() => result.expectResponse("wrong-body.response.json")).toThrow();
    });
  });

  describe("expectTable", () => {
    test("passes when rows match", async () => {
      const result = await spec("matching rows").seed("one-user.sql").get("/users").run();

      await result.expectTable("User", {
        columns: ["name", "email"],
        rows: [["Alice", "alice@test.com"]],
      });
    });

    test("fails on wrong row values", async () => {
      const result = await spec("wrong values").seed("one-user.sql").get("/users").run();

      await expect(
        result.expectTable("User", {
          columns: ["name"],
          rows: [["NonExistent"]],
        }),
      ).rejects.toThrow();
    });

    test("fails on extra rows", async () => {
      const result = await spec("extra rows").seed("two-users.sql").get("/users").run();

      await expect(
        result.expectTable("User", {
          columns: ["name"],
          rows: [["Alice"]],
        }),
      ).rejects.toThrow();
    });

    test("fails on missing rows", async () => {
      const result = await spec("missing rows").get("/users").run();

      await expect(
        result.expectTable("User", {
          columns: ["name"],
          rows: [["Alice"]],
        }),
      ).rejects.toThrow();
    });
  });
});
