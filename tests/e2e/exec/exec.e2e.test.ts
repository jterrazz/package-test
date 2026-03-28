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
    const { createSpecificationRunner } =
      await import("../../../src/specification/specification.js");
    const badSpec = createSpecificationRunner({ server: undefined as any });

    await expect(badSpec("no adapter").exec("build").run()).rejects.toThrow(
      "CLI actions require a command adapter",
    );
  });

  describe("multi-exec", () => {
    test("runs commands sequentially in same directory", async () => {
      // Given — build then start (start needs dist/ from build)
      const result = await cliSpec("build+start").project("cli-app").exec(["build", "start"]).run();

      // Then — start ran successfully (output from last command)
      result.expectExitCode(0);
      result.expectStdoutContains("Hello from CLI app");
    });

    test("stops on first failure", async () => {
      // Given — fail then build (fail exits non-zero, build should not run)
      const result = await cliSpec("fail+build").project("cli-app").exec(["fail", "build"]).run();

      // Then — stopped at fail
      result.expectExitCode(2);
      result.expectStderrContains("Fatal: something went wrong");
    });

    test("preserves files between commands", async () => {
      // Given — build creates dist/, then we check it still exists
      const result = await cliSpec("build+check").project("cli-app").exec(["build", "check"]).run();

      result.expectExitCode(0);
      result.expectFile("dist/index.js");
    });
  });

  describe("spawn", () => {
    test("resolves when pattern is matched in stdout", async () => {
      const result = await cliSpec("dev mode")
        .project("cli-app")
        .spawn("dev", { waitFor: "Hello from CLI app", timeout: 10_000 })
        .run();

      result.expectExitCode(0);
      result.expectStdoutContains("Starting dev mode");
      result.expectStdoutContains("Hello from CLI app");
    });

    test("returns non-zero when process exits without matching pattern", async () => {
      // Given — help exits immediately without matching pattern
      const result = await cliSpec("spawn no match")
        .project("cli-app")
        .spawn("help", { waitFor: "NONEXISTENT_PATTERN", timeout: 5000 })
        .run();

      // Then — exit code 1 (pattern not matched before process exited)
      result.expectExitCode(1);
    });

    test("times out on long-running process without match", async () => {
      // Given — dev runs forever but pattern is never matched
      const result = await cliSpec("dev timeout")
        .project("cli-app")
        .spawn("dev", { waitFor: "NONEXISTENT_PATTERN", timeout: 2000 })
        .run();

      // Then — exit code 124 (timeout)
      result.expectExitCode(124);
    });
  });
});
