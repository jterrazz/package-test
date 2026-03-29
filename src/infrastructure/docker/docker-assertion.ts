import type { DockerContainerPort } from "./docker-port.js";

/** Fluent assertion builder for Docker containers */
export class DockerAssertion {
  constructor(private container: DockerContainerPort) {}

  /** Assert the container is running */
  async toBeRunning(): Promise<this> {
    const running = await this.container.isRunning();
    if (!running) throw new Error("Expected container to be running");
    return this;
  }

  /** Assert the container is NOT running / doesn't exist */
  async toNotExist(): Promise<this> {
    const running = await this.container.isRunning();
    if (running) throw new Error("Expected container to not exist or not be running");
    return this;
  }

  /** Assert a file exists inside the container */
  async toHaveFile(path: string, opts?: { containing?: string }): Promise<this> {
    const file = await this.container.file(path);
    if (!file.exists) throw new Error(`Expected file ${path} to exist in container`);
    if (opts?.containing && !file.content.includes(opts.containing)) {
      throw new Error(
        `Expected file ${path} to contain "${opts.containing}", got: ${file.content.slice(0, 200)}`,
      );
    }
    return this;
  }

  /** Assert a file does NOT exist */
  async toNotHaveFile(path: string): Promise<this> {
    const exists = await this.container.exists(path);
    if (exists) throw new Error(`Expected ${path} to not exist in container`);
    return this;
  }

  /** Assert a directory exists */
  async toHaveDirectory(path: string): Promise<this> {
    const exists = await this.container.exists(path);
    if (!exists) throw new Error(`Expected directory ${path} to exist in container`);
    return this;
  }

  /** Assert a mount exists */
  async toHaveMount(destination: string): Promise<this> {
    const info = await this.container.inspect();
    const mount = info.hostConfig.mounts.find((m) => m.destination === destination);
    if (!mount) {
      const available = info.hostConfig.mounts.map((m) => m.destination).join(", ");
      throw new Error(`Expected mount at ${destination}, found: [${available}]`);
    }
    return this;
  }

  /** Assert network mode */
  async toHaveNetwork(mode: string): Promise<this> {
    const info = await this.container.inspect();
    if (!info.hostConfig.networkMode.includes(mode)) {
      throw new Error(
        `Expected network mode "${mode}", got "${info.hostConfig.networkMode}"`,
      );
    }
    return this;
  }

  /** Assert memory limit */
  async toHaveMemoryLimit(bytes: number): Promise<this> {
    const info = await this.container.inspect();
    if (info.hostConfig.memory !== bytes) {
      throw new Error(`Expected memory limit ${bytes}, got ${info.hostConfig.memory}`);
    }
    return this;
  }

  /** Assert CPU quota */
  async toHaveCpuQuota(quota: number): Promise<this> {
    const info = await this.container.inspect();
    if (info.hostConfig.cpuQuota !== quota) {
      throw new Error(`Expected CPU quota ${quota}, got ${info.hostConfig.cpuQuota}`);
    }
    return this;
  }

  /** Execute a command and return output for custom assertions */
  async exec(cmd: string[]): Promise<string> {
    return this.container.exec(cmd);
  }

  /** Read a file for custom assertions */
  async readFile(path: string): Promise<string> {
    const file = await this.container.file(path);
    if (!file.exists) throw new Error(`File ${path} does not exist`);
    return file.content;
  }

  /** Get logs for custom assertions */
  async getLogs(tail?: number): Promise<string> {
    return this.container.logs(tail);
  }
}
