import { describe, expect, test } from "vitest";

import { cliSpec } from "../../setup/cli.specification.js";

describe("cli — env", () => {
  test("passes user-supplied env vars to the process", async () => {
    // Given — a custom env var
    const result = await cliSpec("env basic")
      .project("cli-app")
      .env({ MY_VAR: "hello" })
      .exec("env")
      .run();

    // Then — the CLI sees it
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("MY_VAR=hello");
  });

  test("merges multiple .env() calls", async () => {
    const result = await cliSpec("env merge")
      .project("cli-app")
      .env({ MY_VAR: "first" })
      .env({ EXTRA: "second" })
      .exec("env")
      .run();

    expect(result.stdout).toContain("MY_VAR=first");
    expect(result.stdout).toContain("EXTRA=second");
  });

  test("expands $WORKDIR token to the actual cwd", async () => {
    // Given — $WORKDIR placeholder for HOME (the typical isolation pattern)
    const result = await cliSpec("env workdir")
      .project("cli-app")
      .env({ HOME: "$WORKDIR" })
      .exec("env")
      .run();

    // Then — HOME points to a real (non-default) path
    expect(result.exitCode).toBe(0);
    const homeLine = result.stdout.split("\n").find((l) => l.startsWith("HOME="));
    expect(homeLine).toBeDefined();
    expect(homeLine).not.toBe("HOME=unset");
    expect(homeLine).toContain("/spec-cli-");
  });

  test("null value unsets a variable", async () => {
    // Given — set then unset (HOME is set on the host)
    const result = await cliSpec("env unset")
      .project("cli-app")
      .env({ HOME: null })
      .exec("env")
      .run();

    expect(result.stdout).toContain("HOME=unset");
  });

  test("env without .env() keeps process.env intact", async () => {
    // Given — no .env() — host PATH should still be available so the script runs
    const result = await cliSpec("env default").project("cli-app").exec("env").run();

    expect(result.exitCode).toBe(0);
    // HOME should be the host's HOME, not "unset"
    expect(result.stdout).not.toContain("HOME=unset");
  });
});
