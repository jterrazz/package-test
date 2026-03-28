import { describe, expect, test } from "vitest";

import { stripAnsi } from "../../../src/index.js";
import { cliSpec } from "../../setup/cli.specification.js";
import { dedent } from "../../setup/helpers/dedent.js";
import { runners } from "../../setup/runners.js";

describe("shared assertions", () => {
  describe("table().toMatch", () => {
    describe.each(runners)("$name", ({ spec }) => {
      test("passes on single column match", async () => {
        const result = await spec("single col").seed("one-user.sql").get("/users").run();
        await result.table("users").toMatch({
          columns: ["name"],
          rows: [["Alice"]],
        });
      });

      test("passes on multi-column match", async () => {
        const result = await spec("multi col").seed("one-user.sql").get("/users").run();
        await result.table("users").toMatch({
          columns: ["name", "email"],
          rows: [["Alice", "alice@test.com"]],
        });
      });

      test("queries a specific service by name", async () => {
        // Given — seed analytics directly
        const result = await spec("query analytics")
          .seed("two-events.sql", { service: "analytics-db" })
          .get("/events")
          .run();

        // Then — multi-column check on analytics-db
        await result.table("events", { service: "analytics-db" }).toMatch({
          columns: ["type", "payload"],
          rows: [
            ["user_created", '{"name":"Alice"}'],
            ["user_created", '{"name":"Bob"}'],
          ],
        });
      });

      test("defaults to first database when service is omitted", async () => {
        const result = await spec("backwards compat").seed("two-users.sql").get("/users").run();

        await result.table("users").toMatch({
          columns: ["name", "email"],
          rows: [
            ["Alice", "alice@test.com"],
            ["Bob", "bob@test.com"],
          ],
        });
      });

      test("fails with multi-column diff", async () => {
        const result = await spec("multi col diff").seed("two-users.sql").get("/users").run();

        try {
          await result.table("users").toMatch({
            columns: ["name", "email"],
            rows: [
              ["Wrong1", "wrong1@test.com"],
              ["Wrong2", "wrong2@test.com"],
            ],
          });
          expect.fail("should have thrown");
        } catch (error: any) {
          expect(stripAnsi(error.message)).toBe(dedent`
                      Table "users" mismatch
                        query: name, email
                        expected: 2 rows
                        received: 2 rows

                      - Expected
                      + Received

                        name  |  email
                      - Wrong1  |  wrong1@test.com
                      + Alice  |  alice@test.com
                      - Wrong2  |  wrong2@test.com
                      + Bob  |  bob@test.com
                  `);
        }
      });

      test("fails with diff on wrong row values", async () => {
        const result = await spec("wrong values").seed("one-user.sql").get("/users").run();

        try {
          await result.table("users").toMatch({ columns: ["name"], rows: [["NonExistent"]] });
          expect.fail("should have thrown");
        } catch (error: any) {
          expect(stripAnsi(error.message)).toBe(dedent`
                      Table "users" mismatch
                        query: name
                        expected: 1 row
                        received: 1 row

                      - Expected
                      + Received

                        name
                      - NonExistent
                      + Alice
                  `);
        }
      });

      test("fails with diff on extra rows", async () => {
        const result = await spec("extra rows").seed("two-users.sql").get("/users").run();

        try {
          await result.table("users").toMatch({ columns: ["name"], rows: [["Alice"]] });
          expect.fail("should have thrown");
        } catch (error: any) {
          expect(stripAnsi(error.message)).toBe(dedent`
                      Table "users" mismatch
                        query: name
                        expected: 1 row
                        received: 2 rows

                      - Expected
                      + Received

                        name
                        Alice
                      + Bob
                  `);
        }
      });

      test("fails with diff on missing rows", async () => {
        const result = await spec("missing rows").get("/users").run();

        try {
          await result.table("users").toMatch({ columns: ["name"], rows: [["Alice"]] });
          expect.fail("should have thrown");
        } catch (error: any) {
          expect(stripAnsi(error.message)).toBe(dedent`
                      Table "users" mismatch
                        query: name
                        expected: 1 row
                        received: 0 rows

                      - Expected
                      + Received

                        name
                      - Alice
                  `);
        }
      });

      test("throws on unknown service name", async () => {
        // Given — valid request
        const result = await spec("bad table service").get("/users").run();

        // Then — table() with nonexistent service fails clearly
        expect(() => result.table("users", { service: "nonexistent-db" })).toThrow(
          'requires database "nonexistent-db" but it was not found',
        );
      });
    });
  });

  describe("file().toExist", () => {
    test("passes when file exists", async () => {
      const result = await cliSpec("file exists").project("cli-app").exec("build").run();
      result.file("dist/index.js").toExist();
    });

    test("fails when file does not exist", async () => {
      const result = await cliSpec("file missing").project("cli-app").exec("build").run();

      try {
        result.file("dist/nonexistent.js").toExist();
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toContain("Expected file to exist");
        expect(error.message).toContain("dist/nonexistent.js");
      }
    });
  });

  describe("file().not.toExist", () => {
    test("passes when file does not exist", async () => {
      const result = await cliSpec("no file").project("cli-app").exec("build").run();
      result.file("dist/index.cjs").not.toExist();
    });

    test("fails when file unexpectedly exists", async () => {
      const result = await cliSpec("unexpected file").project("cli-app").exec("build").run();

      try {
        result.file("dist/index.js").not.toExist();
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toContain("Expected file NOT to exist");
      }
    });
  });

  describe("file().toContain", () => {
    test("passes when file contains string", async () => {
      const result = await cliSpec("file content").project("cli-app").exec("build").run();
      result.file("dist/index.js").toContain("Hello from CLI app");
    });

    test("fails when file does not contain string", async () => {
      const result = await cliSpec("file mismatch").project("cli-app").exec("build").run();

      try {
        result.file("dist/index.js").toContain("NONEXISTENT CONTENT");
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toContain("does not contain expected content");
      }
    });

    test("fails when file does not exist", async () => {
      const result = await cliSpec("file missing").project("cli-app").exec("build").run();

      try {
        result.file("dist/nope.js").toContain("anything");
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(stripAnsi(error.message)).toContain("Expected file to exist");
      }
    });
  });
});
