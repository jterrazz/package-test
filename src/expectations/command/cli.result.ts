import type { MatrixRow } from '../../kernel/chain/capability.js';
import { FilesystemAccessor } from '../disk/filesystem.js';
import { BaseResult } from '../result.js';
import type { ResultConfig } from '../result.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import { ContainerAccessor } from './container.js';
import { findContainersByLabel, inspectContainer, removeContainers } from './docker-cli.js';

/**
 * Raw output from a command execution, including exit code and captured output streams.
 */
export type CliOutput = {
    /** Process exit code (0 = success). */
    exitCode: number;
    /** Captured standard output. */
    stdout: string;
    /** Captured standard error. */
    stderr: string;
};

/**
 * Configuration for the docker-aware cli mode. When set on a cli
 * specification, the runner generates a test-run id, injects it into the
 * child env under `envVar`, then queries Docker for every container carrying
 * `testRunLabel=<id>` after the command exits.
 */
export type DockerSpecConfig = {
    envVar: string;
    nameLabel: string;
    testRunLabel: string;
};

/** What a command's result publishes, as the capability matrix rows it states — `.exec()`'s and `.run()`'s alike. */
export const CLI_RESULT_ROWS: readonly MatrixRow[] = [
    { group: 'Result accessor', name: '.stdout', probe: 'result.stdout' },
    { group: 'Result accessor', name: '.stderr', probe: 'result.stderr' },
    { group: 'Result accessor', name: '.exitCode', probe: 'result.exitCode' },
    { group: 'Result accessor', name: '.json', probe: 'result.json' },
    { group: 'Result accessor', name: '.filesystem', probe: 'result.filesystem' },
    {
        group: 'Result accessor',
        member: 'container',
        name: '.container()',
        probe: 'result.container(',
    },
    { group: 'Result accessor', name: '.containerIds', probe: 'result.containerIds' },
    { group: 'Result accessor', member: 'table', name: '.table()', probe: 'result.table(' },
    { group: 'Result accessor', member: 'file', name: '.file()', probe: '.file(' },
    { group: 'Result accessor', member: 'directory', name: '.directory()', probe: '.directory(' },
];

type CapturedContainer = {
    id: string;
    inspect: unknown;
};

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
    private readonly dockerConfig?: DockerSpecConfig | undefined;
    private readonly testRunId?: string | undefined;
    private readonly transform?: ((text: string) => string) | undefined;

    constructor(options: {
        commandOutput: CliOutput;
        config: ResultConfig;
        dockerConfig?: DockerSpecConfig | undefined;
        testDir: string;
        testRunId?: string | undefined;
        transform?: ((text: string) => string) | undefined;
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
        return new JsonAccessor(this.commandOutput.stdout, 'stdout', this.testDir, {
            captures: this.captures,
            transform: this.transform,
        });
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
        // that the test never asserted on — still clean them up so tests
        // running in parallel never collide.
        const ids =
            this.containersCache === null
                ? findContainersByLabel(this.dockerConfig.testRunLabel, this.testRunId)
                : [...this.containersCache.values()].map((c) => c.id);
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
