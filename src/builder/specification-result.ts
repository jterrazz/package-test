import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { CommandResult } from '../ports/command.port.js';
import type { DatabasePort } from '../ports/database.port.js';
import type { ServerResponse } from '../ports/server.port.js';
import { grep as grepUtil } from '../utilities/grep.js';
import { DirectoryAccessor } from './directory-accessor.js';
import { ResponseAccessor } from './response-accessor.js';
import type { SpecificationConfig } from './specification-builder.js';
import { TableAssertion } from './table-assertion.js';

/** Read-only handle to a single file produced by a CLI action. */
export interface FileAccessor {
    /** The UTF-8 text content. Throws if the file does not exist. */
    readonly content: string;
    readonly exists: boolean;
}

/**
 * The outcome of a single specification run.
 * Provides accessors for CLI output, HTTP responses, files, directories, and database tables.
 */
export class SpecificationResult {
    private commandResult?: CommandResult;
    private config: SpecificationConfig;
    private requestInfo?: { body?: unknown; method: string; path: string };
    private responseData?: ServerResponse;
    private testDir: string;
    private workDir?: string;

    constructor(options: {
        commandResult?: CommandResult;
        config: SpecificationConfig;
        requestInfo?: { body?: unknown; method: string; path: string };
        response?: ServerResponse;
        testDir: string;
        workDir?: string;
    }) {
        this.responseData = options.response;
        this.commandResult = options.commandResult;
        this.config = options.config;
        this.testDir = options.testDir;
        this.requestInfo = options.requestInfo;
        this.workDir = options.workDir;
    }

    // ── Raw value accessors ──

    /** The process exit code. Only available after a CLI action. */
    get exitCode(): number {
        if (!this.commandResult) {
            throw new Error('.exitCode requires a CLI action (.exec())');
        }
        return this.commandResult.exitCode;
    }

    /** The HTTP response status code. Only available after an HTTP action. */
    get status(): number {
        if (!this.responseData) {
            throw new Error('.status requires an HTTP action (.get(), .post(), etc.)');
        }
        return this.responseData.status;
    }

    /** The captured standard output. Only available after a CLI action. */
    get stdout(): string {
        if (!this.commandResult) {
            throw new Error('.stdout requires a CLI action (.exec())');
        }
        return this.commandResult.stdout;
    }

    /** The captured standard error. Only available after a CLI action. */
    get stderr(): string {
        if (!this.commandResult) {
            throw new Error('.stderr requires a CLI action (.exec())');
        }
        return this.commandResult.stderr;
    }

    /**
     * Extract text blocks from stdout that contain a pattern.
     * Useful for parsing structured CLI output (linters, compilers).
     *
     * @example
     *   expect(result.grep('error.ts')).toContain('no-unused-vars');
     */
    grep(pattern: string): string {
        return grepUtil(this.stdout, pattern);
    }

    // ── Structured accessors ──

    /** Access the HTTP response body for assertions. Only available after an HTTP action. */
    get response(): ResponseAccessor {
        if (!this.responseData) {
            throw new Error('.response requires an HTTP action (.get(), .post(), etc.)');
        }
        return new ResponseAccessor(this.responseData.body, this.testDir);
    }

    /** Access a directory (relative to the working directory) for snapshot assertions. */
    directory(path: string = '.'): DirectoryAccessor {
        const baseDir = this.workDir ?? this.testDir;
        return new DirectoryAccessor(resolve(baseDir, path), this.testDir);
    }

    /** Access a single file (relative to the working directory) for content assertions. */
    file(path: string): FileAccessor {
        const baseDir = this.workDir ?? this.testDir;
        const resolvedPath = resolve(baseDir, path);
        const exists = existsSync(resolvedPath);
        return {
            get content(): string {
                if (!exists) {
                    throw new Error(`File not found: ${path}`);
                }
                return readFileSync(resolvedPath, 'utf8');
            },
            exists,
        };
    }

    /** Access a database table for row-level assertions. */
    table(tableName: string, options?: { service?: string }): TableAssertion {
        const db = this.resolveDatabase(options?.service);
        if (!db) {
            throw new Error(
                options?.service
                    ? `table("${tableName}") requires database "${options.service}" but it was not found`
                    : `table("${tableName}") requires a database adapter`,
            );
        }
        return new TableAssertion(tableName, db);
    }

    // ── Private ──

    private resolveDatabase(serviceName?: string): DatabasePort | undefined {
        if (serviceName && this.config.databases) {
            return this.config.databases.get(serviceName);
        }
        return this.config.database;
    }
}
