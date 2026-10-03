import { refusal } from '../../chain/refusals/refusal.js';
import { A_FILE_IS_READ_WHERE_IT_EXISTS } from '../result.js';
import type { FileAccessor } from '../result.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import { CliResult } from './cli.result.js';
import {
    containerLogs,
    execInContainer,
    fieldOf,
    inspectContainer,
    readContainerFile,
} from './docker-cli.js';

function readInspectState(inspect: unknown): { running: boolean; status: string } {
    const state = fieldOf(inspect, 'State', 'state');
    if (state === undefined || state === null) {
        return { running: false, status: 'unknown' };
    }
    const status = fieldOf(state, 'Status', 'status');
    return {
        running: fieldOf(state, 'Running', 'running') === true,
        status: typeof status === 'string' ? status : 'unknown',
    };
}

/** Assertion accessor for one Docker container the docker() mode captured. */
export class ContainerAccessor {
    private cachedLogs: null | string = null;
    private readonly containerId: null | string;
    readonly exists: boolean;
    private readonly inspectData: unknown;
    readonly running: boolean;
    readonly status: string;
    private readonly testDir: string;
    private readonly transform?: ((text: string) => string) | undefined;

    /** The container id, or `null` when none was captured. */
    get id(): null | string {
        return this.containerId;
    }

    constructor(
        containerId: null | string,
        inspectData: unknown,
        testDir: string,
        transform?: (text: string) => string,
    ) {
        this.containerId = containerId;
        this.inspectData = inspectData;
        this.testDir = testDir;
        this.transform = transform;
        this.exists = containerId !== null;
        if (this.exists) {
            const state = readInspectState(inspectData);
            this.running = state.running;
            this.status = state.status;
        } else {
            this.running = false;
            this.status = 'absent';
        }
    }

    /** Raw `docker inspect` object; throws when the container was not captured. */
    get inspect(): JsonAccessor {
        this.requireExists('inspect');
        return new JsonAccessor(JSON.stringify(this.inspectData), 'inspect', this.testDir, {
            transform: this.transform,
        });
    }

    /** Captured logs (stdout+stderr combined for v1). */
    get stdout(): TextAccessor {
        const id = this.requireExists('stdout');
        return new TextAccessor(this.loadLogs(id), 'stdout', this.testDir, {
            transform: this.transform,
        });
    }

    /** Captured logs (stdout+stderr combined for v1). */
    get stderr(): TextAccessor {
        const id = this.requireExists('stderr');
        return new TextAccessor(this.loadLogs(id), 'stderr', this.testDir, {
            transform: this.transform,
        });
    }

    /** A file inside the container, read with `docker exec cat`. */
    file(path: string): FileAccessor {
        const id = this.requireExists('file');
        const exists = execInContainer(id, ['test', '-e', path]).exitCode === 0;
        const { testDir } = this;
        const readContent = (): string => {
            if (!exists) {
                throw new Error(
                    refusal({
                        fix: 'assert `.exists` first, or name a file the container holds',
                        found: `file(${JSON.stringify(path)}).content, and the container holds no such file`,
                        read: 'docs/21-assertions.md#container-subjects-docker-aware-cli',
                        why: A_FILE_IS_READ_WHERE_IT_EXISTS,
                    }),
                );
            }
            return readContainerFile(id, path);
        };
        return {
            get content(): string {
                return readContent();
            },
            exists,
            grep(pattern: string): TextAccessor {
                return new TextAccessor(readContent(), path, testDir).grep(pattern);
            },
        };
    }

    /** Run a shell command inside the container. */
    async exec(cmd: string): Promise<CliResult> {
        const id = this.requireExists('exec');
        const commandOutput = execInContainer(id, ['sh', '-c', cmd]);
        return new CliResult({
            commandOutput,
            config: {},
            testDir: this.testDir,
            transform: this.transform,
            workDir: this.testDir,
        });
    }

    /** The captured container's id — refused when none was captured. */
    private requireExists(member: string): string {
        if (this.containerId === null) {
            throw new Error(
                refusal({
                    fix: 'assert `.exists` first, or name a container the run spawned',
                    found: `ContainerAccessor.${member}, and the container does not exist`,
                    read: 'docs/21-assertions.md#container-subjects-docker-aware-cli',
                    why: 'A container is read only once the run spawned it.',
                }),
            );
        }
        return this.containerId;
    }

    private loadLogs(id: string): string {
        this.cachedLogs ??= containerLogs(id);
        return this.cachedLogs;
    }
}

export function createDockerReader(testDir: string): (containerId: string) => ContainerAccessor {
    return (containerId: string): ContainerAccessor => {
        try {
            const inspect = inspectContainer(containerId);
            return new ContainerAccessor(containerId, inspect, testDir);
        } catch {
            return new ContainerAccessor(null, null, testDir);
        }
    };
}
