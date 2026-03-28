import { afterAll, beforeAll, describe, test } from "vitest";

import { spec, startServer, stopServer } from "../e2e.specification.js";

describe("E2E runner — GET /users/:id", () => {
  beforeAll(() => {
    startServer();
  });

  afterAll(() => {
    stopServer();
  });

  test("returns a single user by id via real HTTP", async () => {
    const result = await spec("gets user").seed("single-user.sql").get("/users/1").run();

    result.expectStatus(200);
    result.expectResponse("user-detail.response.json");
  });

  test("returns 404 for non-existent user", async () => {
    const result = await spec("user not found").get("/users/999").run();

    result.expectStatus(404);
  });
});
