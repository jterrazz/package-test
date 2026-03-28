import { afterAll, beforeAll, describe, test } from "vitest";

import { spec, startServer, stopServer } from "../e2e.specification.js";

describe("E2E runner — POST /users", () => {
  beforeAll(() => {
    startServer();
  });

  afterAll(() => {
    stopServer();
  });

  test("creates a user via real HTTP", async () => {
    const result = await spec("creates user via HTTP")
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
});
