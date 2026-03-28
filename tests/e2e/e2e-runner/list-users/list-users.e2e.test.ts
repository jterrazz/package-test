import { afterAll, beforeAll, describe, test } from "vitest";

import { spec, startServer, stopServer } from "../e2e.specification.js";

describe("E2E runner — GET /users", () => {
  beforeAll(() => {
    startServer();
  });

  afterAll(() => {
    stopServer();
  });

  test("returns all seeded users via real HTTP", async () => {
    const result = await spec("lists users").seed("multiple-users.sql").get("/users").run();

    result.expectStatus(200);
    result.expectResponse("all-users.response.json");
  });

  test("returns empty list on empty database", async () => {
    const result = await spec("lists empty").get("/users").run();

    result.expectStatus(200);
    await result.expectTable("users", {
      columns: ["name"],
      rows: [],
    });
  });
});
