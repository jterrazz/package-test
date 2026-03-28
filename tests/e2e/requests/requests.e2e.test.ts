import { describe, expect, test } from "vitest";

import { runners } from "../../setup/runners.js";

describe.each(runners)("$name — requests", ({ spec }) => {
  test("sends GET request", async () => {
    // Given — seeded data
    const result = await spec("GET").seed("two-users.sql").get("/users").run();

    // Then — 200 OK
    result.status.toBe(200);
  });

  test("sends POST with body from file", async () => {
    // Given — request body loaded from requests/create-user.json
    const result = await spec("POST").post("/users", "create-user.json").run();

    // Then — 201 Created
    result.status.toBe(201);
  });

  test("sends POST that writes to multiple databases", async () => {
    // Given — create a user (app writes to both databases)
    const result = await spec("cross-db write").post("/users", "create-user.json").run();

    result.status.toBe(201);

    // Then — user in default db
    await result.table("users").toMatch({
      columns: ["name", "email"],
      rows: [["Charlie", "charlie@test.com"]],
    });

    // Then — event logged in analytics db
    await result.table("events", { service: "analytics-db" }).toMatch({
      columns: ["type"],
      rows: [["user_created"]],
    });
  });

  test("sends DELETE request", async () => {
    // Given — non-existent resource
    const result = await spec("DELETE").delete("/users/999").run();

    // Then — 404 Not Found
    result.status.toBe(404);
  });

  test("throws when run() called without a request method", async () => {
    // Given — seed but no .get()/.post()/.delete()
    try {
      await spec("no request").seed("one-user.sql").run();
      expect.fail("should have thrown");
    } catch (error: any) {
      // Then — descriptive error with spec label
      expect(error.message).toBe(
        'Specification "no request": no action defined. Call .get(), .post(), .exec(), etc. before .run()',
      );
    }
  });

  test("throws on nonexistent request body file", async () => {
    await expect(spec("bad body").post("/users", "nonexistent.json").run()).rejects.toThrow(
      "ENOENT",
    );
  });
});
