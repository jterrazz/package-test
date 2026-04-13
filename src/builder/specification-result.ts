import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { CommandResult } from '../ports/command.port.js';
import type { DatabasePort } from '../ports/database.port.js';
import type { ServerResponse } from '../ports/server.port.js';
import { DirectoryAccessor } from './directory-accessor.js';
import { ResponseAccessor } from './response-accessor.js';
import type { SpecificationConfig } from './specification-builder.js';
import { TableAssertion } from './table-assertion.js';

export interface FileAccessor {
    readonly content: string;
    readonly exists: boolean;
}

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

    get exitCode(): number {
        if (!this.commandResult) {
            throw new Error('.exitCode requires a CLI action (.exec())');
        }
        return this.commandResult.exitCode;
    }

    get status(): number {
        if (!this.responseData) {
            throw new Error('.status requires an HTTP action (.get(), .post(), etc.)');
        }
        return this.responseData.status;
    }

    get stdout(): string {
        if (!this.commandResult) {
            throw new Error('.stdout requires a CLI action (.exec())');
        }
        return this.commandResult.stdout;
    }

    get stderr(): string {
        if (!this.commandResult) {
            throw new Error('.stderr requires a CLI action (.exec())');
        }
        return this.commandResult.stderr;
    }

    // ── Structured accessors ──

    get response(): ResponseAccessor {
        if (!this.responseData) {
            throw new Error('.response requires an HTTP action (.get(), .post(), etc.)');
        }
        return new ResponseAccessor(this.responseData.body, this.testDir);
    }

    directory(path: string = '.'): DirectoryAccessor {
        const baseDir = this.workDir ?? this.testDir;
        return new DirectoryAccessor(resolve(baseDir, path), this.testDir);
    }

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
