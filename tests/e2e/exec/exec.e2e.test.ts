import { describe, expect, test } from "vitest";

import { cliSpec } from "../../setup/cli.specification.js";

describe("cli — exec", () => {
  test("runs a command successfully", async () => {
    const result = await cliSpec("build").project("cli-app").exec("build").run();
    result.expectExitCode(0);
  });

  test("runs help command", async () => {
    const result = await cliSpec("help").project("cli-app").exec("help").run();
    result.expectExitCode(0);
    result.expectStdoutContains("Usage: cli <command>");
  });

  test("captures non-zero exit code", async () => {
    const result = await cliSpec("fail").project("cli-app").exec("fail").run();
    result.expectExitCode(2);
  });

  test("captures unknown command failure", async () => {
    const result = await cliSpec("unknown").project("cli-app").exec("nonexistent").run();
    result.expectExitCode(1);
    result.expectStderrContains("Unknown command");
  });

  test("throws without action", async () => {
    await expect(cliSpec("no action").project("cli-app").run()).rejects.toThrow(
      "no action defined",
    );
  });

  test("throws without command adapter", async () => {
    // Manually import to create a spec without command
    const { createSpecificationRunner } =
      await import("../../../../src/specification/specification.js");
    const badSpec = createSpecificationRunner({ server: undefined as any });

    await expect(badSpec("no adapter").exec("build").run()).rejects.toThrow(
      "CLI actions require a command adapter",
    );
  });
});
