import { describe, expect, test } from "vitest";

import { stripAnsi } from "../../../src/index.js";
import { cliSpec } from "../../setup/cli.specification.js";

describe("cli assertions", () => {
  describe("expectExitCode", () => {
    test("passes on correct exit code", async () => {
      const result = await cliSpec("exit 0").project("cli-app").exec("build").run();
      result.expectExitCode(0);
    });

    test("fails with formatted error on wrong exit code", async () => {
      const result = await cliSpec("exit mismatch").project("cli-app").exec("fail").run();

      try {
        result.expectExitCode(0);
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

  describe("expectStdoutContains", () => {
    test("passes when stdout contains string", async () => {
      const result = await cliSpec("stdout match").project("cli-app").exec("build").run();
      result.expectStdoutContains("Build completed");
    });

    test("fails when stdout does not contain string", async () => {
      const result = await cliSpec("stdout miss").project("cli-app").exec("build").run();

      try {
        result.expectStdoutContains("NONEXISTENT");
        expect.fail("should have thrown");
      } catch (error: any) {
        expect(error.message).toContain('Expected stdout to contain: "NONEXISTENT"');
        expect(error.message).toContain("Actual stdout:");
      }
    });
  });

  describe("expectStderrContains", () => {
    test("passes when stderr contains string", async () => {
      const result = await cliSpec("stderr match").project("cli-app").exec("fail").run();
      result.expectStderrContains("Fatal: something went wrong");
    });

    test("fails when stderr does not contain string", async () => {
      const result = await cliSpec("stderr miss").project("cli-app").exec("fail").run();

      try {
        result.expectStderrContains("NONEXISTENT");
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
      result.expectExitCode(1);
      result.expectStderrContains("unused-var");
    });

    test("clean project has no invalid files", async () => {
      const result = await cliSpec("clean check").project("cli-app").exec("check").run();

      result.expectExitCode(0);
      result.expectStdoutContains("All checks passed");
    });
  });

  describe("chaining", () => {
    test("chains multiple assertions", async () => {
      const result = await cliSpec("chained").project("cli-app").exec("build").run();

      result
        .expectExitCode(0)
        .expectStdoutContains("Build completed")
        .expectFile("dist/index.js")
        .expectFile("dist/manifest.json")
        .expectNoFile("dist/index.cjs")
        .expectFileContains("dist/index.js", "Hello from CLI app");
    });
  });
});
