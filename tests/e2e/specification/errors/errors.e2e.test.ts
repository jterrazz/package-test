import { describe, expect, test } from "vitest";

import { runners } from "../../../setup/runners.js";

describe.each(runners)("$name — errors", ({ spec }) => {
  test("throws when run() called without a request", async () => {
    await expect(spec("no request").seed("one-user.sql").run()).rejects.toThrow(
      "no request defined",
    );
  });

  test("throws when seed file does not exist", async () => {
    await expect(spec("bad seed").seed("nonexistent.sql").get("/users").run()).rejects.toThrow();
  });

  test("throws when request body file does not exist", async () => {
    await expect(spec("bad body").post("/users", "nonexistent.json").run()).rejects.toThrow();
  });

  test("throws when response file does not exist", async () => {
    const result = await spec("bad response").get("/users").run();

    expect(() => result.expectResponse("nonexistent.json")).toThrow();
  });
});
