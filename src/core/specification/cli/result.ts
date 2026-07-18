import { ContainerAccessor } from '../../../integrations/docker/container-accessor.js';
import {
    findContainersByLabel,
    inspectContainer,
    removeContainers,
} from '../../../integrations/docker/docker-lookup.js';
import type { CliOutput } from '../../ports/cli.port.js';
import type { DockerSpecConfig, SpecificationConfig } from '../shared/builder.js';
import { FilesystemAccessor } from '../shared/result/filesystem.js';
import { JsonAccessor } from '../shared/result/json.js';
import { BaseResult } from '../shared/result/result.js';
import { TextAccessor } from '../shared/result/text.js';

interface CapturedContainer {
    id: string;
    inspect: unknown;
}

/**
 * Result from a command action (`.exec()`).
 *
 * When the runner was configured with a `docker` option, the result also
 * exposes container accessors and participates in `Symbol.asyncDispose`
 * cleanup. The Docker shell-outs are **lazy**: a test that never calls
 * `.container(...)` never queries the Docker daemon, so command-only tests
 * pay zero Docker cost even when the runner is Docker-aware.
 *
 * Dispose always runs one final label-filtered `docker ps` to catch
 * containers that were spawned during `.exec` but never asserted on —
 * tests still get leak-free cleanup even if they forget to reach into
 * a container.
 */
export class CliResult extends BaseResult {
    private readonly commandOutput: CliOutput;
    private containersCache: Map<string, CapturedContainer> | null = null;
    private readonly dockerConfig?: DockerSpecConfig;
    private readonly testRunId?: string;
    private readonly transform?: (text: string) => string;

    constructor(options: {
        commandOutput: CliOutput;
        config: SpecificationConfig;
        dockerConfig?: DockerSpecConfig;
        testDir: string;
        testRunId?: string;
        transform?: (text: string) => string;
        workDir: string;
    }) {
        super(options);
        this.commandOutput = options.commandOutput;
        this.dockerConfig = options.dockerConfig;
        this.testRunId = options.testRunId;
        this.transform = options.transform;
    }

    /** The process exit code. */
    get exitCode(): number {
        return this.commandOutput.exitCode;
    }

    /** Accessor for the captured standard output with file-based assertions. */
    get stdout(): TextAccessor {
        return new TextAccessor(this.commandOutput.stdout, 'stdout', this.testDir, {
            captures: this.captures,
            transform: this.transform,
        });
    }

    /** Accessor for the captured standard error with file-based assertions. */
    get stderr(): TextAccessor {
        return new TextAccessor(this.commandOutput.stderr, 'stderr', this.testDir, {
            captures: this.captures,
            transform: this.transform,
        });
    }

    /** Accessor for parsing stdout as JSON and asserting against JSON fixtures. */
    get json(): JsonAccessor {
        return new JsonAccessor(
            this.commandOutput.stdout,
            this.testDir,
            this.transform,
            this.captures,
        );
    }

    /** Accessor for the temporary working directory the command ran in. */
    get filesystem(): FilesystemAccessor {
        if (!this.workDir) {
            throw new Error('CliResult.filesystem requires a working directory');
        }
        return new FilesystemAccessor(this.workDir, this.testDir, this.captures);
    }

    /**
     * Look up a container the command spawned during this run by the value of
     * its name-label (as declared in the `docker.nameLabel` of the
     * `specification.cli()` options).
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

    private ensureDockerAware(member: string): void {
        if (!this.dockerConfig || !this.testRunId) {
            throw new Error(
                `CliResult.${member}: runner was not configured with a docker option. ` +
                    `Pass \`docker: { envVar, nameLabel, testRunLabel }\` in the specification.cli() options.`,
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
