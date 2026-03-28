import { describe, expect, test } from "vitest";

import { stripAnsi } from "../../../src/index.js";
import { cliSpec } from "../../setup/cli.specification.js";

describe("cli assertions", () => {
  describe("exitCode.toBe", () => {
    test("passes on correct exit code", async () => {
      const result = await cliSpec("exit 0").project("cli-app").exec("build").run();
      result.exitCode.toBe(0);
    });

    test("fails with formatted error on wrong exit code", async () => {
      const result = await cliSpec("exit mismatch").project("cli-app").exec("fail").run();

      try {
        result.exitCode.toBe(0);
        expect.fail("should have thrown");
      } catch (error: any) {
        const msg = stripAnsi(error.message);
        expect(msg).toContain("Expected exit code: 0");
        expect(msg).toContain("Received exit code: 2");
        expect(msg).toContain("stderr:");
        expect(msg).toContain("Fatal: something went wrong");
      }
    });
  });

  describe("stdout.toContain", () => {
    test("passes when stdout contains string", async () => {
      const result = await cliSpec("stdout match").project("cli-app").exec("build").run();
      result.stdout.toContain("Build completed");
    });

    test("fails when stdout does not contain string", async () => {
      const result = await cliSpec("stdout miss").project("cli-app").exec("build").run();

      try {
        result.stdout.toContain("NONEXISTENT");
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(error.message).toContain('Expected stdout to contain: "NONEXISTENT"');
        expect(error.message).toContain("Actual stdout:");
      }
    });
  });

  describe("stderr.toContain", () => {
    test("passes when stderr contains string", async () => {
      const result = await cliSpec("stderr match").project("cli-app").exec("fail").run();
      result.stderr.toContain("Fatal: something went wrong");
    });

    test("fails when stderr does not contain string", async () => {
      const result = await cliSpec("stderr miss").project("cli-app").exec("fail").run();

      try {
        result.stderr.toContain("NONEXISTENT");
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(error.message).toContain('Expected stderr to contain: "NONEXISTENT"');
      }
    });
  });

  describe("fixture setup", () => {
    test("copies fixture file into working dir before exec", async () => {
      // Given — fixture file that triggers check failure
      const result = await cliSpec("fixture check")
        .project("cli-app")
        .fixture("invalid.ts")
        .exec("check")
        .run();

      // Then — check detected the invalid file
      result.exitCode.toBe(1);
      result.stderr.toContain("unused-var");
    });

    test("clean project has no invalid files", async () => {
      const result = await cliSpec("clean check").project("cli-app").exec("check").run();

      result.exitCode.toBe(0);
      result.stdout.toContain("All checks passed");
    });
  });

  describe("chaining", () => {
    test("chains multiple assertions", async () => {
      const result = await cliSpec("chained").project("cli-app").exec("build").run();

      result.exitCode.toBe(0);
      result.stdout.toContain("Build completed");
      result.file("dist/index.js").toExist();
      result.file("dist/manifest.json").toExist();
      result.file("dist/index.cjs").not.toExist();
      result.file("dist/index.js").toContain("Hello from CLI app");
    });
  });
});
