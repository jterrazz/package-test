import { isRecord } from '../../../lint/kit/project/json-shape.js';
import type { MatrixRow } from '../../chain/capability.js';
import { refusal } from '../../chain/refusals/refusal.js';
import {
    fieldOf,
    findContainersByLabel,
    inspectContainer,
    removeContainers,
} from '../../services/containers/docker-cli.js';
import { FilesystemAccessor } from '../disk/filesystem.js';
import { BaseResult } from '../result.js';
import type { ResultConfig } from '../result.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import { ContainerAccessor } from './container.js';

/** A request a binary sent the declared backend: the parsed JSON body or the raw text (`null` when absent), the headers by lowercased name, the uppercased method, and the url as the backend saw it. */
export type SentRequest = {
    body: unknown;
    headers: Record<string, string>;
    method: string;
    url: string;
};

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
    { group: 'Result accessor', name: '.requests', probe: 'result.requests' },
    { group: 'Result accessor', member: 'table', name: '.table()', probe: 'result.table(' },
    { group: 'Result accessor', member: 'file', name: '.file()', probe: '.file(' },
    { group: 'Result accessor', member: 'directory', name: '.directory()', probe: '.directory(' },
];

/** How a result reads and removes the containers of its run: the docker CLI, unless a test hands its own. */
export type RunContainers = {
    labelled: (label: string, value: string) => string[];
    inspect: (id: string) => unknown;
    remove: (ids: string[]) => void;
};

// Stryker disable next-line ObjectLiteral: the default reaches the docker CLI, which no module test may run; a test hands its own
const DOCKER_CLI: RunContainers = {
    labelled: findContainersByLabel,
    inspect: inspectContainer,
    remove: removeContainers,
};

type CapturedContainer = {
    id: string;
    inspect: unknown;
};

/** Result of `.exec()`; with `docker`, containers are queried lazily and removed on dispose. */
export class CliResult extends BaseResult {
    private readonly commandOutput: CliOutput;
    /** The working directory the command ran in: a command always runs in one. */
    private readonly cwd: string;
    private containersCache: Map<string, CapturedContainer[]> | null = null;
    private readonly dockerConfig?: DockerSpecConfig | undefined;
    private readonly received: readonly SentRequest[];
    private readonly containers: RunContainers;
    private readonly testRunId?: string | undefined;
    private readonly transform?: ((text: string) => string) | undefined;

    constructor(options: {
        commandOutput: CliOutput;
        config: ResultConfig;
        containers?: RunContainers | undefined;
        dockerConfig?: DockerSpecConfig | undefined;
        requests?: readonly SentRequest[] | undefined;
        testDir: string;
        testRunId?: string | undefined;
        transform?: ((text: string) => string) | undefined;
        workDir: string;
    }) {
        super(options);
        this.commandOutput = options.commandOutput;
        this.cwd = options.workDir;
        this.dockerConfig = options.dockerConfig;
        this.received = options.requests ?? [];
        this.containers = options.containers ?? DOCKER_CLI;
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
        return new FilesystemAccessor(this.cwd, this.testDir, this.captures);
    }

    /** The requests the binary sent the declared backend during the run, in order, each `{ body, headers, method, url }`, the body parsed when JSON; empty without a backend. */
    get requests(): SentRequest[] {
        return this.received.map((request) => ({ ...request, headers: { ...request.headers } }));
    }

    /** A container the command spawned, by its name-label; `.exists` is `false` when none carries it, and two carrying it are refused. */
    container(name: string): ContainerAccessor {
        const [captured, ...others] = this.capturedContainers('container').get(name) ?? [];
        if (!captured) {
            return containerAt(null, null, this.testDir, this.transform);
        }
        if (others.length > 0) {
            throw new Error(
                refusal({
                    fix: 'give each container of the run its own name-label value, or read them by id: `result.containerIds`, then `docker(id)`',
                    found: `CliResult.container('${name}'), which ${String(others.length + 1)} containers of the run carry: ${[captured, ...others].map(described).join(', ')}`,
                    read: 'docs/guides/cli-specs.md#docker-aware-mode',
                    why: 'A name reads one container, and two carrying it leave which one unsaid.',
                }),
            );
        }
        return containerAt(captured.id, captured.inspect, this.testDir, this.transform);
    }

    /** All captured container IDs. Triggers the same lazy query as `container()`. */
    get containerIds(): string[] {
        return [...this.capturedContainers('containerIds').values()].flat().map((c) => c.id);
    }

    async [Symbol.asyncDispose](): Promise<void> {
        if (!this.dockerConfig || this.testRunId === undefined) {
            return;
        }
        // invariant: re-query when the test never asked: containers it never asserted on are still removed.
        const ids =
            this.containersCache === null
                ? this.containers.labelled(this.dockerConfig.testRunLabel, this.testRunId)
                : [...this.containersCache.values()].flat().map((c) => c.id);
        this.containers.remove(ids);
    }

    private capturedContainers(member: string): ReadonlyMap<string, readonly CapturedContainer[]> {
        if (!this.dockerConfig || this.testRunId === undefined || this.testRunId === '') {
            throw new Error(
                refusal({
                    fix: 'pass `docker: { envVar, nameLabel, testRunLabel }` in the specification.cli() options',
                    found: `CliResult.${member}, and the runner was not configured with a docker option`,
                    read: 'docs/guides/cli-specs.md#docker-aware-mode',
                    why: 'A CLI result reads the containers its run spawned only under Docker-aware mode.',
                }),
            );
        }
        if (this.containersCache !== null) {
            return this.containersCache;
        }
        const { nameLabel, testRunLabel } = this.dockerConfig;
        const map = new Map<string, CapturedContainer[]>();
        for (const id of this.containers.labelled(testRunLabel, this.testRunId)) {
            let inspect: unknown;
            try {
                inspect = this.containers.inspect(id);
            } catch {
                continue;
            }
            const nameValue = labelsOf(inspect)[nameLabel];
            const key = typeof nameValue === 'string' && nameValue.length > 0 ? nameValue : id;
            map.set(key, [...(map.get(key) ?? []), { id, inspect }]);
        }
        this.containersCache = map;
        return map;
    }
}

// outside: docker inspect names a container `Name`, `/<name>`, always with its leading slash.
function described({ id, inspect }: CapturedContainer): string {
    const name = fieldOf(inspect, 'Name');
    return typeof name === 'string' ? `${id} (${name.slice(1)})` : id;
}

function labelsOf(inspect: unknown): Readonly<Record<string, unknown>> {
    const labels = fieldOf(fieldOf(inspect, 'Config', 'config'), 'Labels', 'labels');
    return isRecord(labels) ? labels : {};
}

function containerAt(
    id: null | string,
    inspect: unknown,
    testDir: string,
    transform?: (text: string) => string,
): ContainerAccessor {
    // Stryker disable next-line ArrowFunction: read only by a container's exec, which runs docker; the container specs run it
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

export function createDockerReader(
    testDir: string,
    inspect: RunContainers['inspect'] = inspectContainer,
): (containerId: string) => ContainerAccessor {
    return (containerId: string): ContainerAccessor => {
        try {
            return containerAt(containerId, inspect(containerId), testDir);
        } catch {
            return containerAt(null, null, testDir);
        }
    };
}
