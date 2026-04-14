import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { DatabasePort } from '../adapters/ports/database.port.js';
import type { CommandEnv, CommandPort, CommandResult, SpawnOptions } from './cli/command.port.js';
import type {
    InterceptEntry,
    InterceptResponse,
    InterceptTrigger,
} from './common/intercept/types.js';
import { SpecificationResult } from './common/result.js';
import type { ServerPort } from './http/server.port.js';

// ── Types ──

/** A named job that can be triggered via .job(). */
export interface JobHandle {
    name: string;
    execute: () => Promise<void>;
}

/** Adapter configuration passed to the specification runner at setup time. */
export interface SpecificationConfig {
    command?: CommandPort;
    database?: DatabasePort;
    databases?: Map<string, DatabasePort>;
    fixturesRoot?: string;
    jobs?: JobHandle[];
    server?: ServerPort;
}

/** A SQL seed file to execute before the action, optionally targeting a named database service. */
export interface SeedEntry {
    file: string;
    service?: string;
}

/** A fixture file or directory to copy into the working directory before execution. */
export interface FixtureEntry {
    file: string;
}

/** An MSW mock definition file to register before the action. */
export interface MockEntry {
    file: string;
}

/** An HTTP request to perform against the server adapter. */
export interface RequestEntry {
    bodyFile?: string;
    headers?: Record<string, string>;
    method: string;
    path: string;
}

// ── Builder (before .run()) ──

/**
 * Fluent builder for declaring a single test specification.
 *
 * Chain setup methods ({@link seed}, {@link fixture}, {@link env}), an action
 * ({@link get}, {@link post}, {@link exec}), then call {@link run} to execute
 * and receive a {@link SpecificationResult} for assertions.
 */
export class SpecificationBuilder {
    private commandArgs: null | string | string[] = null;
    private commandEnv: CommandEnv = {};
    private config: SpecificationConfig;
    private fixtures: FixtureEntry[] = [];
    private intercepts: InterceptEntry[] = [];
    private jobName: null | string = null;
    private label: string;
    private mocks: MockEntry[] = [];
    private projectName: null | string = null;
    private request: null | RequestEntry = null;
    private requestHeaders: Record<string, string> = {};
    private seeds: SeedEntry[] = [];
    private spawnConfig: null | { args: string; options: SpawnOptions } = null;
    private testDir: string;

    constructor(config: SpecificationConfig, testDir: string, label: string) {
        this.config = config;
        this.testDir = testDir;
        this.label = label;
    }

    // ── Setup ──

    /**
     * Queue a SQL seed file to run before the action.
     *
     * @example
     *   spec("creates user").seed("users.sql").exec("list-users").run();
     */
    seed(file: string, options?: { service?: string }): this {
        this.seeds.push({ file, service: options?.service });
        return this;
    }

    /** Copy a file or directory from `fixtures/` into the working directory before execution. */
    fixture(file: string): this {
        this.fixtures.push({ file });
        return this;
    }

    /** Copy an entire project fixture from `fixturesRoot` into the working directory. */
    project(name: string): this {
        this.projectName = name;
        return this;
    }

    /** Register an MSW mock definition file from `mock/` to intercept HTTP calls. */
    mock(file: string): this {
        this.mocks.push({ file });
        return this;
    }

    /**
     * Set environment variables for the CLI process. Merged on top of process.env.
     * Use `null` to unset a variable. Multiple calls merge.
     *
     * The token `$WORKDIR` (in any value) is replaced with the actual working
     * directory at run-time — useful for tests that need a fully isolated `HOME`.
     *
     * @example
     *   spec("...").env({ HOME: "$WORKDIR", TZ: "UTC" }).exec("status").run();
     */
    env(env: CommandEnv): this {
        this.commandEnv = { ...this.commandEnv, ...env };
        return this;
    }

    /**
     * Set HTTP headers for the request. Multiple calls merge.
     *
     * @example
     *   spec("french").headers({ 'Accept-Language': 'fr' }).get("/articles").run();
     */
    headers(headers: Record<string, string>): this {
        this.requestHeaders = { ...this.requestHeaders, ...headers };
        return this;
    }

    /**
     * Intercept an outgoing HTTP request and return a controlled response.
     * Uses MSW under the hood. Intercepts are queued — multiple calls with the
     * same trigger fire sequentially (first match consumed first).
     *
     * @param trigger - What to match (use openai.agent(), http.get(), etc.)
     * @param response - What to return: an InterceptResponse object, or a filename
     *   from `intercepts/` (JSON loaded and auto-wrapped by the trigger).
     *
     * @example
     *   // With inline response
     *   .intercept(openai.agent({...}), openai.reply({ categories: ['TECH'] }))
     *
     *   // With JSON fixture file (loaded from intercepts/ directory)
     *   .intercept(openai.agent({...}), 'ingest-tech.json')
     *   .intercept(http.get(url), 'world-news-tech.json')
     */
    intercept(trigger: InterceptTrigger, response: InterceptResponse | string): this {
        if (typeof response === 'string') {
            // File path format: 'adapter/filename.json'
            const slashIndex = response.indexOf('/');
            if (slashIndex === -1) {
                throw new Error(
                    `.intercept(): file path must be 'adapter/filename.json' (e.g. 'openai/ingest-tech.json'), got '${response}'`,
                );
            }

            const adapterName = response.slice(0, slashIndex);
            if (adapterName !== trigger.adapter) {
                throw new Error(
                    `.intercept(): adapter mismatch - trigger uses '${trigger.adapter}' but file path starts with '${adapterName}/'`,
                );
            }

            const filePath = resolve(this.testDir, 'intercepts', response);
            const data = JSON.parse(readFileSync(filePath, 'utf8'));
            const resolved = trigger.wrap(data);
            this.intercepts.push({ trigger, response: resolved });
        } else {
            this.intercepts.push({ trigger, response });
        }
        return this;
    }

    // ── HTTP actions ──

    /**
     * Send a GET request to the server adapter.
     *
     * @example
     *   spec("list items").get("/api/items").run();
     */
    get(path: string): this {
        this.request = { method: 'GET', path };
        return this;
    }

    /**
     * Send a POST request to the server adapter.
     *
     * @param bodyFile - Optional JSON file from `requests/` to use as the request body.
     * @example
     *   spec("create item").post("/api/items", "new-item.json").run();
     */
    post(path: string, bodyFile?: string): this {
        this.request = { bodyFile, method: 'POST', path };
        return this;
    }

    /** Send a PUT request to the server adapter. */
    put(path: string, bodyFile?: string): this {
        this.request = { bodyFile, method: 'PUT', path };
        return this;
    }

    /** Send a DELETE request to the server adapter. */
    delete(path: string): this {
        this.request = { method: 'DELETE', path };
        return this;
    }

    // ── CLI actions ──

    /**
     * Execute a CLI command (or a sequence of commands) in an isolated working directory.
     * When an array is passed, commands run sequentially and stop on the first non-zero exit code.
     *
     * @example
     *   spec("init project").exec("init --name demo").run();
     *   spec("multi-step").exec(["init", "build"]).run();
     */
    exec(args: string | string[]): this {
        this.commandArgs = args;
        return this;
    }

    /** Spawn a long-running CLI process with custom spawn options (e.g. timeout, signal). */
    spawn(args: string, options: SpawnOptions): this {
        this.spawnConfig = { args, options };
        return this;
    }

    // ── Job actions ──

    /**
     * Execute a named job registered via the app() factory.
     *
     * @param name - The job name to trigger (must match a registered JobHandle.name).
     *
     * @example
     *   spec('pipeline').intercept(openai.chat(), openai.response({...})).job('report-refresh').run();
     */
    job(name: string): this {
        this.jobName = name;
        return this;
    }

    // ── Run ──

    /**
     * Execute the specification: run seeds, copy fixtures, then perform the
     * configured action (HTTP or CLI).
     *
     * @returns The result object used for assertions.
     * @example
     *   const result = await spec("test").exec("status").run();
     *   expect(result.exitCode).toBe(0);
     */
    async run(): Promise<SpecificationResult> {
        const hasHttpAction = this.request !== null;
        const hasCliAction = this.commandArgs !== null || this.spawnConfig !== null;
        const hasJobAction = this.jobName !== null;

        const actionCount = [hasHttpAction, hasCliAction, hasJobAction].filter(Boolean).length;

        if (actionCount === 0) {
            throw new Error(
                `Specification "${this.label}": no action defined. Call .get(), .post(), .exec(), .job(), etc. before .run()`,
            );
        }

        if (actionCount > 1) {
            throw new Error(
                `Specification "${this.label}": cannot mix action types (.get/.post, .exec/.spawn, .job)`,
            );
        }

        let workDir: null | string = null;
        if (hasCliAction) {
            workDir = this.prepareWorkDir();
        }

        // Reset all databases
        if (this.config.databases) {
            for (const db of this.config.databases.values()) {
                await db.reset();
            }
        } else if (this.config.database) {
            await this.config.database.reset();
        }

        // Execute seeds
        for (const entry of this.seeds) {
            let db: DatabasePort | undefined;
            if (entry.service && this.config.databases) {
                db = this.config.databases.get(entry.service);
                if (!db) {
                    throw new Error(
                        `seed() targets database "${entry.service}" but it was not found. Available: ${[...this.config.databases.keys()].join(', ')}`,
                    );
                }
            } else {
                db = this.config.database;
            }

            if (!db) {
                throw new Error('seed() requires a database adapter');
            }

            const sql = readFileSync(resolve(this.testDir, 'seeds', entry.file), 'utf8');
            await db.seed(sql);
        }

        // Copy fixture files into working directory
        if (this.fixtures.length > 0 && workDir) {
            for (const entry of this.fixtures) {
                const src = resolve(this.testDir, 'fixtures', entry.file);
                const dest = resolve(workDir, entry.file);
                cpSync(src, dest, { recursive: true });
            }
        }

        // Register HTTP intercepts via MSW
        let cleanupIntercepts: (() => void) | null = null;
        if (this.intercepts.length > 0) {
            const { registerIntercepts } = await import('./common/intercept/intercept.js');
            cleanupIntercepts = await registerIntercepts(this.intercepts);
        }

        // Execute action
        try {
            if (hasHttpAction) {
                return await this.runHttpAction();
            }
            if (hasJobAction) {
                return await this.runJobAction();
            }
            return await this.runCliAction(workDir!);
        } finally {
            if (cleanupIntercepts) {
                cleanupIntercepts();
            }
        }
    }

    // ── Private ──

    private resolveEnv(workDir: string): CommandEnv | undefined {
        const keys = Object.keys(this.commandEnv);
        if (keys.length === 0) {
            return undefined;
        }

        const resolved: CommandEnv = {};
        for (const key of keys) {
            const value = this.commandEnv[key];
            resolved[key] =
                typeof value === 'string' ? value.replace(/\$WORKDIR/g, workDir) : value;
        }
        return resolved;
    }

    private prepareWorkDir(): string {
        // Every CLI spec runs in a fresh, empty temp directory unless a project
        // Fixture is explicitly copied in via .project() (or files via .fixture()).
        // This guarantees isolation — the runner never writes into fixturesRoot.
        const tempDir = mkdtempSync(resolve(tmpdir(), 'spec-cli-'));

        if (this.projectName && this.config.fixturesRoot) {
            const projectDir = resolve(this.config.fixturesRoot, this.projectName);
            if (!existsSync(projectDir)) {
                throw new Error(
                    `project("${this.projectName}"): fixture project not found at ${projectDir}`,
                );
            }
            cpSync(projectDir, tempDir, { recursive: true });
        }

        return tempDir;
    }

    private async runHttpAction(): Promise<SpecificationResult> {
        if (!this.config.server) {
            throw new Error('HTTP actions require a server adapter (use integration() or e2e())');
        }

        let body: unknown;
        if (this.request!.bodyFile) {
            body = JSON.parse(
                readFileSync(resolve(this.testDir, 'requests', this.request!.bodyFile), 'utf8'),
            );
        }

        const headers =
            Object.keys(this.requestHeaders).length > 0 ? this.requestHeaders : undefined;
        const response = await this.config.server.request(
            this.request!.method,
            this.request!.path,
            body,
            headers,
        );

        return new SpecificationResult({
            config: this.config,
            requestInfo: { body, method: this.request!.method, path: this.request!.path },
            response,
            testDir: this.testDir,
        });
    }

    private async runJobAction(): Promise<SpecificationResult> {
        if (!this.config.jobs?.length) {
            throw new Error(
                'Job actions require jobs registered via app(() => ({ server, jobs }))',
            );
        }

        const job = this.config.jobs.find((j) => j.name === this.jobName);
        if (!job) {
            const available = this.config.jobs.map((j) => j.name).join(', ');
            throw new Error(`job("${this.jobName}"): not found. Available: ${available}`);
        }

        await job.execute();

        return new SpecificationResult({
            config: this.config,
            testDir: this.testDir,
        });
    }

    private async runCliAction(workDir: string): Promise<SpecificationResult> {
        if (!this.config.command) {
            throw new Error('CLI actions require a command adapter (use cli())');
        }

        const env = this.resolveEnv(workDir);
        let commandResult: CommandResult;

        if (this.spawnConfig) {
            commandResult = await this.config.command.spawn(
                this.spawnConfig.args,
                workDir,
                this.spawnConfig.options,
                env,
            );
        } else if (Array.isArray(this.commandArgs)) {
            commandResult = { exitCode: 0, stderr: '', stdout: '' };
            for (const args of this.commandArgs) {
                commandResult = await this.config.command.exec(args, workDir, env);
                if (commandResult.exitCode !== 0) {
                    break;
                }
            }
        } else {
            commandResult = await this.config.command.exec(this.commandArgs!, workDir, env);
        }

        return new SpecificationResult({
            commandResult,
            config: this.config,
            testDir: this.testDir,
            workDir,
        });
    }
}

// ── Caller detection ──

function getCallerDir(): string {
    const stack = new Error('caller detection').stack;
    if (!stack) {
        throw new Error('Cannot detect caller directory: no stack trace');
    }

    const lines = stack.split('\n');
    for (const line of lines) {
        const match = line.match(/at\s+(?:.*?\()?(?:file:\/\/)?([^:)]+):\d+:\d+/);
        if (!match) {
            continue;
        }

        const filePath = match[1];

        if (filePath.includes('node_modules')) {
            continue;
        }
        if (filePath.includes('/src/builder/') || filePath.includes('/src/spec/')) {
            continue;
        }

        return resolve(filePath, '..');
    }

    throw new Error('Cannot detect caller directory from stack trace');
}

// ── Factory functions ──

/** Factory function returned by `cli()`, `integration()`, or `e2e()` that starts a new spec. */
export type SpecificationRunner = (label: string) => SpecificationBuilder;

/**
 * Create a {@link SpecificationRunner} bound to the given adapter configuration.
 * The test file directory is auto-detected from the call stack.
 */
export function createSpecificationRunner(config: SpecificationConfig): SpecificationRunner {
    return (label: string) => {
        const testDir = getCallerDir();
        return new SpecificationBuilder(config, testDir, label);
    };
}
