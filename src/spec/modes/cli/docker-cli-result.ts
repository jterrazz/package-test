import type { SpecificationConfig } from '../../builder.js';
import type { CommandResult } from './command.port.js';
import { ContainerAccessor } from './container-accessor.js';
import { removeContainers } from './docker-lookup.js';
import { CliResult } from './result.js';

export interface CapturedContainer {
    id: string;
    inspect: unknown;
}

export interface DockerCliResultOptions {
    commandResult: CommandResult;
    config: SpecificationConfig;
    containers: Map<string, CapturedContainer>;
    nameLabel: string;
    testDir: string;
    testRunId: string;
    testRunLabel: string;
    transform?: (text: string) => string;
    workDir: string;
}

/**
 * Result returned by the docker() spec mode. Extends {@link CliResult} with
 * accessors over the Docker containers the CLI spawned during this run.
 *
 * Cleanup is wired to `Symbol.asyncDispose` so tests can use `await using`
 * to auto-remove every tracked container when the scope exits — no manual
 * teardown, no leaks between tests.
 */
export class DockerCliResult extends CliResult {
    private readonly containers: Map<string, CapturedContainer>;
    private readonly dockerTestDir: string;
    private readonly dockerTransform?: (text: string) => string;

    readonly nameLabel: string;
    readonly testRunId: string;
    readonly testRunLabel: string;

    constructor(options: DockerCliResultOptions) {
        super({
            commandResult: options.commandResult,
            config: options.config,
            testDir: options.testDir,
            transform: options.transform,
            workDir: options.workDir,
        });
        this.containers = options.containers;
        this.nameLabel = options.nameLabel;
        this.testRunId = options.testRunId;
        this.testRunLabel = options.testRunLabel;
        this.dockerTestDir = options.testDir;
        this.dockerTransform = options.transform;
    }

    /**
     * Look up a container the CLI spawned by its `<nameLabel>` value. Returns
     * an accessor with `.exists === false` if no container was captured with
     * that name — tests can still assert absence without handling throws.
     */
    container(name: string): ContainerAccessor {
        const captured = this.containers.get(name);
        if (!captured) {
            return new ContainerAccessor(null, null, this.dockerTestDir, this.dockerTransform);
        }
        return new ContainerAccessor(
            captured.id,
            captured.inspect,
            this.dockerTestDir,
            this.dockerTransform,
        );
    }

    /** All captured container IDs. Useful for bulk assertions. */
    get containerIds(): string[] {
        return [...this.containers.values()].map((c) => c.id);
    }

    async [Symbol.asyncDispose](): Promise<void> {
        removeContainers(this.containerIds);
    }
}
