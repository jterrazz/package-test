import { describe, test } from "vitest";

import { runners } from "../../../setup/runners.js";

describe.each(runners)("$name — requests", ({ spec }) => {
  test("sends GET request", async () => {
    const result = await spec("GET").seed("two-users.sql").get("/users").run();

    result.expectStatus(200);
  });

  test("sends POST with body from file", async () => {
    const result = await spec("POST").post("/users", "create-user.json").run();

    result.expectStatus(201);
  });

  test("sends DELETE request", async () => {
    const result = await spec("DELETE").delete("/users/999").run();

    result.expectStatus(404);
  });
});
