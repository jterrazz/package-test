import { execSync } from 'node:child_process';

import type { DockerContainerPort, DockerInspectResult } from './docker-port.js';

export class DockerAdapter implements DockerContainerPort {
    private containerId: string;

    constructor(containerId: string) {
        this.containerId = containerId;
    }

    async exec(cmd: string[]): Promise<string> {
        const result = execSync(
            `docker exec ${this.containerId} ${cmd.map((c) => `'${c}'`).join(' ')}`,
            { encoding: 'utf8', timeout: 10_000 },
        );
        return result.trim();
    }

    async file(path: string): Promise<{ exists: boolean; content: string }> {
        try {
            const content = await this.exec(['cat', path]);
            return { exists: true, content };
        } catch {
            return { exists: false, content: '' };
        }
    }

    async isRunning(): Promise<boolean> {
        try {
            const result = execSync(
                `docker inspect --format='{{.State.Running}}' ${this.containerId}`,
                {
                    encoding: 'utf8',
                    timeout: 5000,
                },
            );
            return result.trim() === 'true';
        } catch {
            return false;
        }
    }

    async logs(tail?: number): Promise<string> {
        const tailFlag = tail ? `--tail ${tail}` : '';
        const result = execSync(`docker logs ${tailFlag} ${this.containerId}`, {
            encoding: 'utf8',
            timeout: 10_000,
        });
        return result;
    }

    async inspect(): Promise<DockerInspectResult> {
        const raw = execSync(`docker inspect ${this.containerId}`, {
            encoding: 'utf8',
            timeout: 5000,
        });
        const data = JSON.parse(raw)[0];
        return {
            id: data.Id,
            name: data.Name,
            state: {
                running: data.State.Running,
                exitCode: data.State.ExitCode,
                status: data.State.Status,
            },
            config: {
                image: data.Config.Image,
                env: data.Config.Env || [],
            },
            hostConfig: {
                memory: data.HostConfig.Memory || 0,
                cpuQuota: data.HostConfig.CpuQuota || 0,
                networkMode: data.HostConfig.NetworkMode || '',
                mounts: (data.Mounts || []).map((m: any) => ({
                    source: m.Source,
                    destination: m.Destination,
                    type: m.Type,
                })),
            },
            networkSettings: {
                networks: Object.fromEntries(
                    Object.entries(data.NetworkSettings.Networks || {}).map(
                        ([name, net]: [string, any]) => [
                            name,
                            { gateway: net.Gateway, ipAddress: net.IPAddress },
                        ],
                    ),
                ),
            },
        };
    }

    async exists(path: string): Promise<boolean> {
        try {
            await this.exec(['test', '-e', path]);
            return true;
        } catch {
            return false;
        }
    }
}

/** Create a Docker container port for an existing container */
export function dockerContainer(containerId: string): DockerContainerPort {
    return new DockerAdapter(containerId);
}
