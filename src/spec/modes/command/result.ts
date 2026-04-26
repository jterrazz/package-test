import type { DockerSpecConfig, SpecificationConfig } from '../../builder.js';
import { FilesystemAccessor } from '../../result/filesystem.js';
import { grep as grepUtil } from '../../result/grep.js';
import { JsonAccessor } from '../../result/json.js';
import { BaseResult } from '../../result/result.js';
import { StreamAccessor } from '../../result/stream.js';
import type { CommandResult } from './command.port.js';
import { ContainerAccessor } from './container-accessor.js';
import { findContainersByLabel, inspectContainer, removeContainers } from './docker-lookup.js';

interface CapturedContainer {
    id: string;
    inspect: unknown;
}

/**
 * Result from a CLI action (.exec(), .spawn()).
 *
 * When the runner was configured with a `docker` option, the result also
 * exposes container accessors and participates in `Symbol.asyncDispose`
 * cleanup. The Docker shell-outs are **lazy**: a test that never calls
 * `.container(...)` never queries the Docker daemon, so CLI-only tests
 * pay zero Docker cost even when the runner is Docker-aware.
 *
 * Dispose always runs one final label-filtered `docker ps` to catch
 * containers that were spawned during `.exec` but never asserted on —
 * tests still get leak-free cleanup even if they forget to reach into
 * a container.
 */
export class CliResult extends BaseResult {
    private readonly commandResult: CommandResult;
    private containersCache: Map<string, CapturedContainer> | null = null;
    private readonly dockerConfig?: DockerSpecConfig;
    private readonly testRunId?: string;
    private readonly transform?: (text: string) => string;

    constructor(options: {
        commandResult: CommandResult;
        config: SpecificationConfig;
        dockerConfig?: DockerSpecConfig;
        testDir: string;
        testRunId?: string;
        transform?: (text: string) => string;
        workDir: string;
    }) {
        super(options);
        this.commandResult = options.commandResult;
        this.dockerConfig = options.dockerConfig;
        this.testRunId = options.testRunId;
        this.transform = options.transform;
    }

    /** The process exit code. */
    get exitCode(): number {
        return this.commandResult.exitCode;
    }

    /** Accessor for the captured standard output with file-based assertions. */
    get stdout(): StreamAccessor {
        return new StreamAccessor(
            this.commandResult.stdout,
            'stdout',
            this.testDir,
            this.transform,
        );
    }

    /** Accessor for the captured standard error with file-based assertions. */
    get stderr(): StreamAccessor {
        return new StreamAccessor(
            this.commandResult.stderr,
            'stderr',
            this.testDir,
            this.transform,
        );
    }

    /** Accessor for parsing stdout as JSON and asserting against JSON fixtures. */
    get json(): JsonAccessor {
        return new JsonAccessor(this.commandResult.stdout, this.testDir, this.transform);
    }

    /** Accessor for the temporary working directory the command ran in. */
    get filesystem(): FilesystemAccessor {
        if (!this.workDir) {
            throw new Error('CliResult.filesystem requires a working directory');
        }
        return new FilesystemAccessor(this.workDir, this.testDir);
    }

    /**
     * Look up a container the CLI spawned during this run by the value of
     * its name-label (as declared in `SpecOptions.docker.nameLabel`).
     * First access triggers a one-shot `docker ps` + `docker inspect`
     * query and caches the result for the rest of the result's lifetime.
     * Tests that don't call this never touch Docker.
     *
     * Returns an accessor with `.exists === false` when no container
     * carries that name — callers can still assert absence without a try.
     */
    container(name: string): ContainerAccessor {
        this.ensureDockerAware('container');
        this.loadContainers();
        const captured = this.containersCache!.get(name);
        if (!captured) {
            return new ContainerAccessor(null, null, this.testDir, this.transform);
        }
        return new ContainerAccessor(captured.id, captured.inspect, this.testDir, this.transform);
    }

    /** All captured container IDs. Triggers the same lazy query as `container()`. */
    get containerIds(): string[] {
        this.ensureDockerAware('containerIds');
        this.loadContainers();
        return [...this.containersCache!.values()].map((c) => c.id);
    }

    async [Symbol.asyncDispose](): Promise<void> {
        if (!this.dockerConfig || !this.testRunId) {
            return;
        }
        // If the test touched `.container(...)` we already have the id set.
        // Otherwise re-query once to catch containers spawned during `.exec`
        // That the test never asserted on — still clean them up so tests
        // Running in parallel never collide.
        const ids =
            this.containersCache !== null
                ? [...this.containersCache.values()].map((c) => c.id)
                : findContainersByLabel(this.dockerConfig.testRunLabel, this.testRunId);
        removeContainers(ids);
    }

    /**
     * Extract text blocks from stdout that contain a pattern.
     *
     * @example
     *   expect(result.grep('error.ts')).toContain('no-unused-vars');
     */
    grep(pattern: string): string {
        return grepUtil(this.commandResult.stdout, pattern);
    }

    private ensureDockerAware(member: string): void {
        if (!this.dockerConfig || !this.testRunId) {
            throw new Error(
                `CliResult.${member}: runner was not configured with a docker option. ` +
                    `Pass \`docker: { envVar, nameLabel, testRunLabel }\` in SpecOptions.`,
            );
        }
    }

    private loadContainers(): void {
        if (this.containersCache !== null) {
            return;
        }
        const ids = findContainersByLabel(this.dockerConfig!.testRunLabel, this.testRunId!);
        const map = new Map<string, CapturedContainer>();
        for (const id of ids) {
            let inspect: unknown;
            try {
                inspect = inspectContainer(id);
            } catch {
                continue;
            }
            const labels =
                (inspect as any)?.Config?.Labels ?? (inspect as any)?.config?.labels ?? {};
            const nameValue = labels[this.dockerConfig!.nameLabel];
            const key = typeof nameValue === 'string' && nameValue.length > 0 ? nameValue : id;
            map.set(key, { id, inspect });
        }
        this.containersCache = map;
    }
}
