import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { CaptureScope } from '../../../matching/match.js';
import type { DatabasePort } from '../../../ports/database.port.js';
import type { SpecificationConfig } from '../builder.js';
import { DirectoryAccessor } from './directory.js';
import { TableAccessor } from './table.js';
import { TextAccessor } from './text.js';

/** Read-only handle to a single file produced by a spec action. */
export interface FileAccessor {
    /** The UTF-8 text content. Throws if the file does not exist. */
    readonly content: string;
    readonly exists: boolean;
    /** The file text as a {@link TextAccessor}, keeping only blocks matching `pattern`. */
    grep: (pattern: string) => TextAccessor;
}

export interface BaseResultOptions {
    config: SpecificationConfig;
    testDir: string;
    workDir?: string;
}

/**
 * Base result - common accessors available after any action type.
 * Extended by HttpResult, CliResult, and used directly by job results.
 *
 * Every result carries a fresh {@link CaptureScope}: `match.ref()` captures
 * and `{{type#ref}}` placeholders are scoped to one spec execution.
 */
export class BaseResult {
    /** @internal Ref-capture scope shared by every assertion on this result. */
    readonly captures: CaptureScope;
    protected config: SpecificationConfig;
    protected testDir: string;
    protected workDir?: string;

    constructor(options: BaseResultOptions) {
        this.config = options.config;
        this.testDir = options.testDir;
        this.workDir = options.workDir;
        // The framework knows the exact cwd of the spec — this is what the
        // {{workdir}} token / match.workdir() compare against (CONVENTIONS
        // D4). The realpath form is what child processes print ($PWD /
        // Process.cwd() resolve tmpdir symlinks on macOS).
        this.captures = new CaptureScope(
            options.workDir ? safeRealpath(options.workDir) : undefined,
        );
    }

    /** Access a directory (relative to the working directory) for snapshot assertions. */
    directory(path: string = '.'): DirectoryAccessor {
        const baseDir = this.workDir ?? this.testDir;
        return new DirectoryAccessor(resolve(baseDir, path), this.testDir, this.captures);
    }

    /** Access a single file (relative to the working directory) for content assertions. */
    file(path: string): FileAccessor {
        const baseDir = this.workDir ?? this.testDir;
        const resolvedPath = resolve(baseDir, path);
        const exists = existsSync(resolvedPath);
        const { captures, testDir } = this;
        return {
            get content(): string {
                if (!exists) {
                    throw new Error(`File not found: ${path}`);
                }
                return readFileSync(resolvedPath, 'utf8');
            },
            exists,
            grep(pattern: string): TextAccessor {
                if (!exists) {
                    throw new Error(`File not found: ${path}`);
                }
                return new TextAccessor(readFileSync(resolvedPath, 'utf8'), path, testDir, {
                    captures,
                }).grep(pattern);
            },
        };
    }

    /** Access a database table for row-level assertions via expect() matchers. */
    table(tableName: string, options?: { database?: string }): TableAccessor {
        validateDatabaseOption('table', this.config, options?.database);
        const db = this.resolveDatabase(options?.database);
        if (!db) {
            throw new Error(
                options?.database
                    ? `table("${tableName}") requires database "${options.database}" but it was not found`
                    : `table("${tableName}") requires a database adapter`,
            );
        }
        return new TableAccessor(tableName, db, this.captures);
    }

    private resolveDatabase(databaseKey?: string): DatabasePort | undefined {
        if (databaseKey && this.config.databases) {
            return this.config.databases.get(databaseKey);
        }
        return this.config.database;
    }
}

function safeRealpath(path: string): string {
    try {
        return realpathSync(path);
    } catch {
        return path;
    }
}

/**
 * Enforce CONVENTIONS A7: with two or more databases in the services record
 * the `database` option is mandatory on `.seed()` / `.table()`; with exactly
 * one it is forbidden (redundant).
 *
 * @internal
 */
export function validateDatabaseOption(
    method: string,
    config: SpecificationConfig,
    database: string | undefined,
): void {
    const keys = config.databaseKeys;
    if (!keys) {
        return;
    }
    if (keys.length >= 2 && !database) {
        throw new Error(
            `${method}(): ${keys.length} databases are declared (${keys.map((k) => `"${k}"`).join(', ')}) — ` +
                `pass { database: <key> } to target one of them.`,
        );
    }
    if (keys.length === 1 && database) {
        throw new Error(
            `${method}(): redundant database option — "${keys[0]}" is the only declared database.`,
        );
    }
}
