import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { SpecificationConfig } from '../builder.js';
import type { DatabasePort } from '../ports/database.port.js';
import { DirectoryAccessor } from './directory.js';
import { TableAssertion } from './table.js';

/** Read-only handle to a single file produced by a spec action. */
export interface FileAccessor {
    /** The UTF-8 text content. Throws if the file does not exist. */
    readonly content: string;
    readonly exists: boolean;
}

export interface BaseResultOptions {
    config: SpecificationConfig;
    testDir: string;
    workDir?: string;
}

/**
 * Base result - common accessors available after any action type.
 * Extended by HttpResult, CliResult, and used directly by JobResult.
 */
export class BaseResult {
    protected config: SpecificationConfig;
    protected testDir: string;
    protected workDir?: string;

    constructor(options: BaseResultOptions) {
        this.config = options.config;
        this.testDir = options.testDir;
        this.workDir = options.workDir;
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

    private resolveDatabase(serviceName?: string): DatabasePort | undefined {
        if (serviceName && this.config.databases) {
            return this.config.databases.get(serviceName);
        }
        return this.config.database;
    }
}
