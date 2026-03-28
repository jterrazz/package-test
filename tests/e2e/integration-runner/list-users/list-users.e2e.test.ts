import { describe, test } from "vitest";

import { spec } from "../integration.specification.js";

describe("GET /users", () => {
  test("returns all seeded users", async () => {
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
