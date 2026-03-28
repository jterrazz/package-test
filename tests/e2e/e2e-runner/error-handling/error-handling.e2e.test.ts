import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { spec, startServer, stopServer } from "../e2e.specification.js";

describe("E2E runner — error handling", () => {
  beforeAll(() => {
    startServer();
  });

  afterAll(() => {
    stopServer();
  });

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
  });

  describe("builder validation", () => {
    test("fails when run() is called without a request", async () => {
      await expect(spec("no request").seed("one-user.sql").run()).rejects.toThrow(
        "no request defined",
      );
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
