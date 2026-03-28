import { describe, test } from "vitest";

import { runners } from "../../../setup/runners.js";

describe.each(runners)("$name — requests", ({ spec }) => {
  test("sends GET request", async () => {
    // Given — seeded data
    const result = await spec("GET").seed("two-users.sql").get("/users").run();

    // Then — 200 OK
    result.expectStatus(200);
  });

  test("sends POST with body from file", async () => {
    // Given — request body loaded from requests/create-user.json
    const result = await spec("POST").post("/users", "create-user.json").run();

    // Then — 201 Created
    result.expectStatus(201);
  });

  test("sends DELETE request", async () => {
    // Given — non-existent resource
    const result = await spec("DELETE").delete("/users/999").run();

    // Then — 404 Not Found
    result.expectStatus(404);
  });
});
