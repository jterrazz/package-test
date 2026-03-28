import { describe, expect, test } from "vitest";

import { runners } from "../../../setup/runners.js";

describe.each(runners)("$name — errors", ({ spec }) => {
  test("throws when run() called without a request", async () => {
    try {
      await spec("no request").seed("one-user.sql").run();
      expect.fail("should have thrown");
    } catch (error: any) {
      expect(error.message).toBe(
        'Specification "no request": no request defined. Call .get(), .post(), etc. before .run()',
      );
    }
  });

  test("throws when seed file does not exist", async () => {
    await expect(spec("bad seed").seed("nonexistent.sql").get("/users").run()).rejects.toThrow(
      "ENOENT",
    );
  });

  test("throws when request body file does not exist", async () => {
    await expect(spec("bad body").post("/users", "nonexistent.json").run()).rejects.toThrow(
      "ENOENT",
    );
  });

  test("throws when response file does not exist", async () => {
    const result = await spec("bad response").get("/users").run();

    expect(() => result.expectResponse("nonexistent.json")).toThrow("ENOENT");
  });
});
