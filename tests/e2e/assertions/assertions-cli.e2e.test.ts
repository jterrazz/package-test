import { describe, expect, test } from "vitest";

import { cliSpec } from "../../setup/cli.specification.js";

describe("cli assertions", () => {
  describe("exitCode", () => {
    test("passes on correct exit code", async () => {
      const result = await cliSpec("exit 0").project("cli-app").exec("build").run();
      expect(result.exitCode).toBe(0);
    });
  });

  describe("stdout", () => {
    test("passes when stdout contains string", async () => {
      const result = await cliSpec("stdout match").project("cli-app").exec("build").run();
      expect(result.stdout).toContain("Build completed");
    });
  });

  describe("stderr", () => {
    test("passes when stderr contains string", async () => {
      const result = await cliSpec("stderr match").project("cli-app").exec("fail").run();
      expect(result.stderr).toContain("Fatal: something went wrong");
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
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("unused-var");
    });

    test("clean project has no invalid files", async () => {
      const result = await cliSpec("clean check").project("cli-app").exec("check").run();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("All checks passed");
    });
  });

  describe("chaining", () => {
    test("chains multiple assertions", async () => {
      const result = await cliSpec("chained").project("cli-app").exec("build").run();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Build completed");
      expect(result.file("dist/index.js").exists).toBe(true);
      expect(result.file("dist/manifest.json").exists).toBe(true);
      expect(result.file("dist/index.cjs").exists).toBe(false);
      expect(result.file("dist/index.js").content).toContain("Hello from CLI app");
    });
  });
});
