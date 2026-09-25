import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ChainConfig } from '../kernel/chain/config.js';
import { validateDatabaseOption } from '../kernel/database-option.js';
import { safeRealpath } from '../kernel/files/resolve.js';
import { DirectoryAccessor } from './disk/directory.js';
import { TableAccessor } from './table/table.js';
import type { TableSource } from './table/table.js';
import { TextAccessor } from './text/text.js';
import { CaptureScope } from './tokens/match.js';

/** Read-only handle to a single file produced by a spec action. */
export type FileAccessor = {
    /** The UTF-8 text content. Throws if the file does not exist. */
    readonly content: string;
    readonly exists: boolean;
    /** The file text as a {@link TextAccessor}, keeping only blocks matching `pattern`. */
    grep: (pattern: string) => TextAccessor;
};

export type ResultConfig = ChainConfig & {
    database?: TableSource | undefined;
    databaseKeys?: readonly string[] | undefined;
    databases?: ReadonlyMap<string, TableSource> | undefined;
    transform?: ((text: string) => string) | undefined;
};

export type BaseResultOptions = {
    config: ResultConfig;
    testDir: string;
    workDir?: string | undefined;
};

/** Accessors available after any action; each result carries a fresh `CaptureScope`. */
export class BaseResult {
    /** @internal Ref-capture scope shared by every assertion on this result. */
    readonly captures: CaptureScope;
    protected config: ResultConfig;
    protected testDir: string;
    protected workDir?: string | undefined;

    constructor(options: BaseResultOptions) {
        this.config = options.config;
        this.testDir = options.testDir;
        this.workDir = options.workDir;
        // The realpath form is what child processes print as `$PWD` (macOS resolves the tmpdir symlink).
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

    private resolveDatabase(databaseKey?: string): TableSource | undefined {
        if (databaseKey && this.config.databases) {
            return this.config.databases.get(databaseKey);
        }
        return this.config.database;
    }
}
