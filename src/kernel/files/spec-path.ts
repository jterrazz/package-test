import { refusal } from '../refusals/refusal.js';

/** A path relative to the spec file; `Extension` narrows its tail. */
export type RelativePath<Extension extends string = string> =
    | `../${string}${Extension}`
    | `./${string}${Extension}`;

export const DISK_KEY = '@jterrazz/test:disk';

/** A registry symbol, so every build of the package reads the same brand. */
const DISK: unique symbol = Symbol.for(DISK_KEY);

/** A file the spec names, at `Path`. */
export type FileAt<Path extends string> = {
    readonly [DISK]: 'file';
    readonly path: Path;
};

/** A file whose path ends in `Extension` — what a verb that reads one file accepts. */
export type DiskFile<Extension extends string = string> = FileAt<RelativePath<Extension>>;

/** A directory the spec names; its path ends in `/`. */
export type DiskDirectory = {
    readonly [DISK]: 'directory';
    readonly path: RelativePath<'/'>;
};

/** Either of the two — what a verb that takes a file or a directory accepts. */
export type DiskTarget = DiskDirectory | DiskFile;

export function isRelativePath(value: string): boolean {
    return value.startsWith('./') || value.startsWith('../');
}

function asRelative(path: unknown): string {
    const bare = typeof path === 'string' ? path.replace(/^\/+/u, '') : '';
    return `./${bare === '' ? 'expected/output.txt' : bare}`;
}

export function requireRelativePath(call: string, path: unknown): asserts path is string {
    if (typeof path !== 'string' || !isRelativePath(path)) {
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `start it with ./ or ../, from the spec file: ${call}('${asRelative(path)}')`,
                found: `${call}(${JSON.stringify(path)}), a path that is not relative to the spec file`,
            }),
        );
    }
}

/** Name one file, by its path from the spec file. */
export function file<const Path extends RelativePath>(
    path: Path extends `${string}/` ? never : Path,
): FileAt<Path> {
    requireRelativePath('file', path);
    if (path.endsWith('/')) {
        const bare = path.replace(/\/+$/u, '');
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `name the directory with directory(${JSON.stringify(path)}), or the file without its /: file(${JSON.stringify(bare)})`,
                found: `file(${JSON.stringify(path)}), a path ending in / — a directory's`,
            }),
        );
    }
    return diskValue('file', path) as FileAt<Path>;
}

/** Refuses when read as a pattern: a plain object would match `[object Object]` against any text. */
function diskValue(brand: 'directory' | 'file', path: string): object {
    const value = { [DISK]: brand, path };
    Object.defineProperty(value, Symbol.match, {
        value: () => {
            throw new TypeError(
                refusal('one-verb-per-meaning', {
                    fix: `wrap the string to golden it — \`expect(text(value)).toMatch(${brand}(…))\` — or compare it to a value, \`toMatch('…')\``,
                    found: `toMatch(${brand}(${JSON.stringify(path)})) on a string, a value with no golden`,
                }),
            );
        },
    });
    return Object.freeze(value);
}

/** Name one directory, by its path from the spec file, ending in `/`. */
export function directory<const Path extends RelativePath<'/'>>(
    path: Path,
): DiskDirectory & { readonly path: Path } {
    requireRelativePath('directory', path);
    if (!path.endsWith('/')) {
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `end it in /: directory(${JSON.stringify(`${path}/`)}), or name a file with file(${JSON.stringify(path)})`,
                found: `directory(${JSON.stringify(path)}), a path that does not end in /`,
            }),
        );
    }
    return diskValue('directory', path) as DiskDirectory & {
        readonly path: Path;
    };
}

export function isDiskFile(value: unknown): value is DiskFile {
    return brandOf(value) === 'file';
}

export function isDiskDirectory(value: unknown): value is DiskDirectory {
    return brandOf(value) === 'directory';
}

export function isDiskTarget(value: unknown): value is DiskTarget {
    return brandOf(value) !== undefined;
}

function brandOf(value: unknown): 'directory' | 'file' | undefined {
    if (value === null || typeof value !== 'object') {
        return undefined;
    }
    const brand = (value as { [DISK]?: unknown })[DISK];
    return brand === 'file' || brand === 'directory' ? brand : undefined;
}

function spelled(value: unknown): string {
    if (isDiskTarget(value)) {
        return `${brandOf(value)}(${JSON.stringify(value.path)})`;
    }
    return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

export function requireDiskFile(verb: string, value: unknown, extension = ''): DiskFile {
    if (!isDiskFile(value)) {
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `name one file: ${verb}(file('./${exampleOf(verb, extension)}'))`,
                found: isDiskDirectory(value)
                    ? `${verb}(${spelled(value)}), a directory where one file is read`
                    : `${verb}(${spelled(value)}), a value where a file is read`,
            }),
        );
    }
    if (!value.path.endsWith(extension)) {
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `name the ${extension} file ${verb}() reads: ${verb}(file('./${exampleOf(verb, extension)}'))`,
                found: `${verb}(${spelled(value)}), a file not ending in ${extension}`,
            }),
        );
    }
    return value;
}

export function requireDiskTarget(verb: string, value: unknown): DiskTarget {
    if (!isDiskTarget(value)) {
        throw new TypeError(
            refusal('disk-named-by-relative-path-at-runtime', {
                fix: `name the disk: ${verb}(file('./…')) for a file, ${verb}(directory('./…/')) for a directory`,
                found: `${verb}(${spelled(value)}), a value where the disk is read`,
            }),
        );
    }
    return value;
}

function exampleOf(verb: string, extension: string): string {
    const folder: Record<string, string> = {
        fixture: 'fixtures/config.json',
        request: 'requests/create.http',
        run: 'case.spec.yaml',
        seed: 'seeds/rows.sql',
    };
    return folder[verb] ?? `expected/output${extension || '.txt'}`;
}
