import { describe, expect, test } from "vitest";

import { runners } from "../../setup/runners.js";

describe.each(runners)("$name — seeding", ({ spec }) => {
  test("loads a single seed file", async () => {
    // Given — one user seeded
    const result = await spec("single seed").seed("one-user.sql").get("/users").run();

    // Then — user is in the database
    await result.table("users").toMatch({
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
    await result.table("users").toMatch({
      columns: ["name"],
      rows: [["Alice"], ["Charlie"]],
    });
  });

  test("seeds default database without service option", async () => {
    // Given — seed users in default db
    const result = await spec("default seed").seed("one-user.sql").get("/users").run();

    // Then — user appears in default database
    await result.table("users").toMatch({
      columns: ["name"],
      rows: [["Alice"]],
    });
  });

  test("seeds a specific database with service option", async () => {
    // Given — seed events in analytics-db
    const result = await spec("analytics seed")
      .seed("one-event.sql", { service: "analytics-db" })
      .get("/events")
      .run();

    // Then — event appears in analytics database
    await result.table("events", { service: "analytics-db" }).toMatch({
      columns: ["type", "payload"],
      rows: [["user_created", '{"name":"Alice"}']],
    });
  });

  test("seeds both databases independently", async () => {
    // Given — seed users in default db and events in analytics-db
    const result = await spec("dual seed")
      .seed("two-users.sql")
      .seed("two-events.sql", { service: "analytics-db" })
      .get("/users")
      .run();

    // Then — users in default db
    await result.table("users").toMatch({
      columns: ["name"],
      rows: [["Alice"], ["Bob"]],
    });

    // Then — events in analytics db
    await result.table("events", { service: "analytics-db" }).toMatch({
      columns: ["type"],
      rows: [["user_created"], ["user_created"]],
    });
  });

  test("throws on nonexistent seed file", async () => {
    await expect(spec("bad seed").seed("nonexistent.sql").get("/users").run()).rejects.toThrow(
      "ENOENT",
    );
  });

  test("throws on unknown service name", async () => {
    await expect(
      spec("bad service").seed("one-user.sql", { service: "nonexistent-db" }).get("/users").run(),
    ).rejects.toThrow('seed() targets database "nonexistent-db" but it was not found');
  });
});
