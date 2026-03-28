import { describe, test } from "vitest";

import { runners } from "../../../setup/runners.js";

describe.each(runners)("$name — seeding", ({ spec }) => {
  test("resets database before each spec", async () => {
    await spec("seed first").seed("two-users.sql").get("/users").run();

    const result = await spec("verify clean").get("/users").run();

    await result.expectTable("users", {
      columns: ["name"],
      rows: [],
    });
  });

  test("loads a single seed file", async () => {
    const result = await spec("single seed").seed("one-user.sql").get("/users").run();

    await result.expectTable("users", {
      columns: ["name", "email"],
      rows: [["Alice", "alice@test.com"]],
    });
  });

  test("loads multiple seed files in order", async () => {
    const result = await spec("multiple seeds")
      .seed("one-user.sql")
      .seed("third-user.sql")
      .get("/users")
      .run();

    await result.expectTable("users", {
      columns: ["name"],
      rows: [["Alice"], ["Charlie"]],
    });
  });
});
