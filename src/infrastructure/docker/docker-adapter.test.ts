import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { dockerContainer } from "./docker-adapter.js";
import { DockerAssertion } from "./docker-assertion.js";

function isDockerRunning(): boolean {
  try {
    execSync("docker info", { encoding: "utf8", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const describeDocker = isDockerRunning() ? describe : describe.skip;

describeDocker("DockerAdapter", () => {
  let containerId: string;

  beforeAll(() => {
    containerId = execSync("docker run -d --rm alpine:latest sleep 60", {
      encoding: "utf8",
    }).trim();
  });

  afterAll(() => {
    try {
      execSync(`docker kill ${containerId}`);
    } catch {}
  });

  test("isRunning returns true", async () => {
    const container = dockerContainer(containerId);
    expect(await container.isRunning()).toBe(true);
  });

  test("exec runs command", async () => {
    const container = dockerContainer(containerId);
    const result = await container.exec(["echo", "hello"]);
    expect(result).toBe("hello");
  });

  test("file reads content", async () => {
    const container = dockerContainer(containerId);
    const file = await container.file("/etc/hostname");
    expect(file.exists).toBe(true);
    expect(file.content).toBeTruthy();
  });

  test("file returns false for missing", async () => {
    const container = dockerContainer(containerId);
    const file = await container.file("/nonexistent");
    expect(file.exists).toBe(false);
  });

  test("inspect returns container info", async () => {
    const container = dockerContainer(containerId);
    const info = await container.inspect();
    expect(info.state.running).toBe(true);
    expect(info.config.image).toContain("alpine");
  });
});

describeDocker("DockerAssertion", () => {
  let containerId: string;

  beforeAll(() => {
    containerId = execSync("docker run -d --rm alpine:latest sleep 60", {
      encoding: "utf8",
    }).trim();
  });

  afterAll(() => {
    try {
      execSync(`docker kill ${containerId}`);
    } catch {}
  });

  test("toBeRunning passes", async () => {
    const assertion = new DockerAssertion(dockerContainer(containerId));
    await assertion.toBeRunning();
  });

  test("toHaveFile passes for existing file", async () => {
    const assertion = new DockerAssertion(dockerContainer(containerId));
    await assertion.toHaveFile("/etc/hostname");
  });

  test("toHaveFile with containing", async () => {
    const assertion = new DockerAssertion(dockerContainer(containerId));
    // /etc/os-release contains "Alpine"
    await assertion.toHaveFile("/etc/os-release", { containing: "Alpine" });
  });

  test("toNotHaveFile passes for missing file", async () => {
    const assertion = new DockerAssertion(dockerContainer(containerId));
    await assertion.toNotHaveFile("/nonexistent");
  });
});
