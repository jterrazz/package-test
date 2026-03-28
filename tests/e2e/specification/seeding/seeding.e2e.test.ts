import { describe, expect, test } from "vitest";

import { runners } from "../../../setup/runners.js";

describe.each(runners)("$name — seeding", ({ spec }) => {
  test("resets database before each spec", async () => {
    // Given — data from a previous spec
    await spec("seed first").seed("two-users.sql").get("/users").run();

    // When — new spec without seeding
    const result = await spec("verify clean").get("/users").run();

    // Then — table is empty
    await result.expectTable("users", { columns: ["name"], rows: [] });
  });

  test("loads a single seed file", async () => {
    // Given — one user seeded
    const result = await spec("single seed").seed("one-user.sql").get("/users").run();

    // Then — user is in the database
    await result.expectTable("users", {
      columns: ["name", "email"],
      rows: [["Alice", "alice@test.com"]],
    });
  });

  test("loads multiple seed files in order", async () => {
    // Given — two seed files applied sequentially
    const result = await spec("multiple seeds")
      .seed("one-user.sql")
      .seed("third-user.sql")
      .get("/users")
      .run();

    // Then — both seeds applied
    await result.expectTable("users", {
      columns: ["name"],
      rows: [["Alice"], ["Charlie"]],
    });
  });

  test("throws on nonexistent seed file", async () => {
    // Given — reference to nonexistent seed
    await expect(spec("bad seed").seed("nonexistent.sql").get("/users").run()).rejects.toThrow(
      "ENOENT",
    );
  });
});
