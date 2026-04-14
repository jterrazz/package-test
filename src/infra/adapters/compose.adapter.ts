import { execSync } from 'node:child_process';
import { dirname } from 'node:path';

import type { ContainerPort } from '../ports/container.port.js';

/**
 * Container adapter using docker compose — runs full compose stack.
 * Used by e2e() to start all services including the app.
 */
export class ComposeAdapter implements ContainerPort {
    private composeFile: string;
    private serviceName: string;
    private started = false;

    constructor(composeFile: string, serviceName: string) {
        this.composeFile = composeFile;
        this.serviceName = serviceName;
    }

    private exec(command: string): string {
        return execSync(command, {
            cwd: dirname(this.composeFile),
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'inherit'],
        }).trim();
    }

    async start(): Promise<void> {
        if (this.started) {
            return;
        }

        this.exec(`docker compose -f ${this.composeFile} up -d --wait ${this.serviceName}`);
        this.started = true;
    }

    async stop(): Promise<void> {
        if (!this.started) {
            return;
        }

        this.exec(`docker compose -f ${this.composeFile} rm -fsv ${this.serviceName}`);
        this.started = false;
    }

    getMappedPort(containerPort: number): number {
        const output = this.exec(
            `docker compose -f ${this.composeFile} port ${this.serviceName} ${containerPort}`,
        );
        // Output: 0.0.0.0:54321
        const port = output.split(':').pop();
        return Number(port);
    }

    getHost(): string {
        return 'localhost';
    }

    getConnectionString(): string {
        return `${this.getHost()}:${this.getMappedPort(0)}`;
    }

    async getLogs(): Promise<string> {
        try {
            return this.exec(
                `docker compose -f ${this.composeFile} logs ${this.serviceName} --tail=50`,
            );
        } catch {
            return '';
        }
    }
}

/**
 * Start the full compose stack and stop it all on cleanup.
 * Supports per-worker project names for parallel execution.
 */
export class ComposeStackAdapter {
    private composeFile: string;
    private projectName: null | string;
    private started = false;

    constructor(composeFile: string, projectName?: string) {
        this.composeFile = composeFile;
        this.projectName = projectName ?? null;
    }

    private get projectFlag(): string {
        return this.projectName ? `-p ${this.projectName}` : '';
    }

    private run(command: string): string {
        try {
            return execSync(command, {
                cwd: dirname(this.composeFile),
                encoding: 'utf8',
                timeout: 120_000,
            }).trim();
        } catch (error: any) {
            const stderr = error.stderr?.toString().trim() ?? error.message;
            throw new Error(`docker compose failed: ${stderr}`, { cause: error });
        }
    }

    async start(): Promise<void> {
        if (this.started) {
            return;
        }

        this.run(`docker compose ${this.projectFlag} -f ${this.composeFile} up -d --wait`);
        this.started = true;
    }

    async stop(): Promise<void> {
        if (!this.started) {
            return;
        }

        this.run(`docker compose ${this.projectFlag} -f ${this.composeFile} down -v`);
        this.started = false;
    }

    getMappedPort(serviceName: string, containerPort: number): number {
        const output = this.run(
            `docker compose ${this.projectFlag} -f ${this.composeFile} port ${serviceName} ${containerPort}`,
        );
        const port = output.split(':').pop();
        return Number(port);
    }

    getHost(): string {
        return 'localhost';
    }
}
