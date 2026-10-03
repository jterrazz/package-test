import type { MatrixRow } from '../../chain/capability.js';
import { invariant, refusal } from '../../chain/refusals/refusal.js';
import { FilesystemAccessor } from '../disk/filesystem.js';
import { BaseResult } from '../result.js';
import type { ResultConfig } from '../result.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import { ContainerAccessor } from './container.js';
import {
    fieldOf,
    findContainersByLabel,
    inspectContainer,
    removeContainers,
} from './docker-cli.js';

/** Raw output of a command: exit code and captured streams. */
export type CliOutput = {
    /** Process exit code (0 = success). */
    exitCode: number;
    /** Captured standard output. */
    stdout: string;
    /** Captured standard error. */
    stderr: string;
};

/** The docker-aware cli mode: containers carrying `testRunLabel=<id>` are found after the command exits. */
export type DockerSpecConfig = {
    envVar: string;
    nameLabel: string;
    testRunLabel: string;
};

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

/** Result of `.exec()`; with `docker`, containers are queried lazily and removed on dispose. */
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
        if (this.workDir === undefined) {
            throw invariant('a CLI result was built with no working directory');
        }
        return new FilesystemAccessor(this.workDir, this.testDir, this.captures);
    }

    /** A container the command spawned, by its name-label; `.exists` is `false` when none carries it. */
    container(name: string): ContainerAccessor {
        const captured = this.capturedContainers('container').get(name);
        if (!captured) {
            return containerAt(null, null, this.testDir, this.transform);
        }
        return containerAt(captured.id, captured.inspect, this.testDir, this.transform);
    }

    /** All captured container IDs. Triggers the same lazy query as `container()`. */
    get containerIds(): string[] {
        return [...this.capturedContainers('containerIds').values()].map((c) => c.id);
    }

    async [Symbol.asyncDispose](): Promise<void> {
        if (!this.dockerConfig || this.testRunId === undefined) {
            return;
        }
        // invariant: re-query when the test never asked: containers it never asserted on are still removed.
        const ids =
            this.containersCache === null
                ? findContainersByLabel(this.dockerConfig.testRunLabel, this.testRunId)
                : [...this.containersCache.values()].map((c) => c.id);
        removeContainers(ids);
    }

    private capturedContainers(member: string): ReadonlyMap<string, CapturedContainer> {
        if (!this.dockerConfig || this.testRunId === undefined || this.testRunId === '') {
            throw new Error(
                refusal({
                    fix: 'pass `docker: { envVar, nameLabel, testRunLabel }` in the specification.cli() options',
                    found: `CliResult.${member}, and the runner was not configured with a docker option`,
                    read: 'docs/14-cli.md#docker-aware-mode',
                    why: 'A CLI result reads the containers its run spawned only under Docker-aware mode.',
                }),
            );
        }
        if (this.containersCache !== null) {
            return this.containersCache;
        }
        const { nameLabel, testRunLabel } = this.dockerConfig;
        const map = new Map<string, CapturedContainer>();
        for (const id of findContainersByLabel(testRunLabel, this.testRunId)) {
            let inspect: unknown;
            try {
                inspect = inspectContainer(id);
            } catch {
                continue;
            }
            const nameValue = labelsOf(inspect)[nameLabel];
            const key = typeof nameValue === 'string' && nameValue.length > 0 ? nameValue : id;
            map.set(key, { id, inspect });
        }
        this.containersCache = map;
        return map;
    }
}

function labelsOf(inspect: unknown): Readonly<Record<string, unknown>> {
    const labels = fieldOf(fieldOf(inspect, 'Config', 'config'), 'Labels', 'labels');
    return typeof labels === 'object' && labels !== null ? { ...labels } : {};
}

function containerAt(
    id: null | string,
    inspect: unknown,
    testDir: string,
    transform?: (text: string) => string,
): ContainerAccessor {
    const resultOf = (commandOutput: CliOutput): CliResult =>
        new CliResult({ commandOutput, config: {}, testDir, transform, workDir: testDir });
    return new ContainerAccessor({
        containerId: id,
        inspectData: inspect,
        resultOf,
        testDir,
        transform,
    });
}

export function createDockerReader(testDir: string): (containerId: string) => ContainerAccessor {
    return (containerId: string): ContainerAccessor => {
        try {
            return containerAt(containerId, inspectContainer(containerId), testDir);
        } catch {
            return containerAt(null, null, testDir);
        }
    };
}
