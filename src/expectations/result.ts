import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { safeRealpath } from '../../lint/kit/project/resolve.js';
import type { ChainConfig } from '../chain/config.js';
import { refusal } from '../chain/refusals/refusal.js';
import { validateDatabaseOption } from '../services/database-option.js';
import { DirectoryAccessor } from './disk/directory.js';
import { TableAccessor } from './table/table.js';
import type { TableSource } from './table/table.js';
import { TextAccessor } from './text/text.js';
import { CaptureScope } from './tokens/match.js';

/** Read-only handle to a single file produced by a spec action. */
export const A_FILE_IS_READ_WHERE_IT_EXISTS = 'A file is read only where it exists.';

function missingFile(path: string): Error {
    return new Error(
        refusal({
            fix: 'assert `.exists` first, or name a file the run left',
            found: `file(${JSON.stringify(path)}), and the run left no such file`,
            read: 'docs/21-assertions.md#resultfilepath--single-files-in-the-cwd-cli',
            why: A_FILE_IS_READ_WHERE_IT_EXISTS,
        }),
    );
}

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
    /** @internal */
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
        const readContent = (): string => {
            if (!exists) {
                throw missingFile(path);
            }
            return readFileSync(resolvedPath, 'utf8');
        };
        return {
            get content(): string {
                return readContent();
            },
            exists,
            grep(pattern: string): TextAccessor {
                return new TextAccessor(readContent(), path, testDir, {
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
                refusal(
                    options?.database
                        ? {
                              fix: `name a declared database: ${(this.config.databaseKeys ?? []).join(', ')}`,
                              found: `table("${tableName}") reads the database "${options.database}", and none is declared under that key`,
                              read: 'docs/18-services.md#the-database-rule',
                              why: '`database:` names a key of the services record.',
                          }
                        : {
                              fix: 'declare a database in the specification’s `services` — `postgres()` or `sqlite()`',
                              found: `table("${tableName}"), and no database is declared`,
                              read: 'docs/18-services.md#the-database-rule',
                              why: 'A table is read from a declared database.',
                          },
                ),
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
