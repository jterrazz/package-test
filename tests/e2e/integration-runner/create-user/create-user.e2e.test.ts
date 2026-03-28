import { describe, test } from "vitest";

import { spec } from "../integration.specification.js";

describe("POST /users", () => {
  test("creates a user and returns 201", async () => {
    const result = await spec("creates a user")
      .seed("initial-users.sql")
      .post("/users", "new-user.json")
      .run();

    result.expectStatus(201);
    result.expectResponse("created.response.json");
    await result.expectTable("users", {
      columns: ["name", "email"],
      rows: [
        ["Alice", "alice@test.com"],
        ["Bob", "bob@test.com"],
        ["Charlie", "charlie@test.com"],
      ],
    });
  });

  test("creates a user on empty database", async () => {
    const result = await spec("creates on empty db").post("/users", "new-user.json").run();

    result.expectStatus(201);
    await result.expectTable("users", {
      columns: ["name", "email"],
      rows: [["Charlie", "charlie@test.com"]],
    });
  });
});
