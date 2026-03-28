import { describe, expect, test } from "vitest";

import { runners } from "../runners.js";

describe.each(runners)("$name — error handling", ({ spec }) => {
  describe("expectStatus", () => {
    test("fails when status does not match", async () => {
      const result = await spec("wrong status").get("/users/999").run();

      expect(() => result.expectStatus(200)).toThrow();
    });
  });

  describe("expectResponse", () => {
    test("fails when response body does not match", async () => {
      const result = await spec("wrong response")
        .seed("one-user.sql")
        .post("/users", "new-user.json")
        .run();

      expect(() => result.expectResponse("wrong-response.json")).toThrow();
    });
  });

  describe("expectTable", () => {
    test("fails when table rows do not match", async () => {
      const result = await spec("wrong table").seed("one-user.sql").get("/users").run();

      await expect(
        result.expectTable("users", {
          columns: ["name"],
          rows: [["NonExistent"]],
        }),
      ).rejects.toThrow();
    });

    test("fails when table has unexpected extra rows", async () => {
      const result = await spec("extra rows").seed("one-user.sql").get("/users").run();

      await expect(
        result.expectTable("users", {
          columns: ["name"],
          rows: [],
        }),
      ).rejects.toThrow();
    });

    test("fails when table has fewer rows than expected", async () => {
      const result = await spec("missing rows").get("/users").run();

      await expect(
        result.expectTable("users", {
          columns: ["name"],
          rows: [["Alice"]],
        }),
      ).rejects.toThrow();
    });
  });

  describe("builder validation", () => {
    test("fails when run() is called without a request", async () => {
      await expect(spec("no request").seed("one-user.sql").run()).rejects.toThrow(
        "no request defined",
      );
    });

    test("fails when seed file does not exist", async () => {
      await expect(spec("bad seed").seed("nonexistent.sql").get("/users").run()).rejects.toThrow();
    });

    test("fails when input file does not exist", async () => {
      await expect(spec("bad input").post("/users", "nonexistent.json").run()).rejects.toThrow();
    });

    test("fails when response file does not exist", async () => {
      const result = await spec("bad response file").get("/users").run();

      expect(() => result.expectResponse("nonexistent.json")).toThrow();
    });
  });

  describe("database reset", () => {
    test("resets database between specs", async () => {
      await spec("seed data").seed("one-user.sql").get("/users").run();

      const result = await spec("clean db").get("/users").run();

      await result.expectTable("users", {
        columns: ["name"],
        rows: [],
      });
    });
  });
});
