import { describe, expect, test } from "vitest";

import { integrationSpec } from "../../../setup/integration.specification.js";

describe("failure reporting", () => {
  const spec = integrationSpec;

  describe("expectStatus", () => {
    test("includes request and response context", async () => {
      const result = await spec("status failure context")
        .seed("one-user.sql")
        .post("/users", "create-user.json")
        .run();

      try {
        result.expectStatus(500);
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(error.message).toContain("Expected status 500");
        expect(error.message).toContain("received 201");
        expect(error.message).toContain("POST /users");
        expect(error.message).toContain("Request");
        expect(error.message).toContain("Response");
      }
    });

    test("shows request body in context", async () => {
      const result = await spec("body in context").post("/users", "create-user.json").run();

      try {
        result.expectStatus(500);
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(error.message).toContain("Charlie");
        expect(error.message).toContain("charlie@test.com");
      }
    });

    test("shows response body in context", async () => {
      const result = await spec("response in context").get("/users/999").run();

      try {
        result.expectStatus(200);
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(error.message).toContain("User not found");
      }
    });
  });

  describe("expectResponse", () => {
    test("throws on mismatch", async () => {
      const result = await spec("response mismatch").seed("one-user.sql").get("/users").run();

      expect(() => result.expectResponse("wrong.response.json")).toThrow();
    });
  });

  describe("expectTable", () => {
    test("throws on row mismatch", async () => {
      const result = await spec("table mismatch").seed("one-user.sql").get("/users").run();

      await expect(
        result.expectTable("users", {
          columns: ["name"],
          rows: [["NonExistent"]],
        }),
      ).rejects.toThrow();
    });
  });
});
