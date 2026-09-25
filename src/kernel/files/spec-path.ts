/**
 * The disk, as a spec names it: `file()` and `directory()`.
 *
 * A string is a value. What a test stands on — a seed, a request, a fixture, a
 * document, a golden — is named by one of these two calls, with a path spelled
 * relative to the spec file, so what the line reads is visible on the line and
 * no folder is implied behind a bare name.
 *
 * The value they return is BRANDED: a verb that reads the disk accepts it and
 * nothing else, and a verb that takes a value refuses it. The brand is a
 * registry symbol (`Symbol.for`), so every build of the package — the node
 * entry, the page's, a source checkout beside a bundle — reads the same one.
 */

import { refusal } from '../refusals/refusal.js';

/** A path relative to the spec file; `Extension` narrows its tail. */
export type RelativePath<Extension extends string = string> =
    | `../${string}${Extension}`
    | `./${string}${Extension}`;

/** The registry key the brand is stored under. */
export const DISK_KEY = '@jterrazz/test:disk';

/** The brand every `file()` and `directory()` value carries. */
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

/** Does the value start the way a relative path must? */
export function isRelativePath(value: string): boolean {
    return value.startsWith('./') || value.startsWith('../');
}

/** A path as the relative one it may have meant — `out.txt` → `./out.txt`. */
function asRelative(path: unknown): string {
    const bare = typeof path === 'string' ? path.replace(/^\/+/u, '') : '';
    return `./${bare === '' ? 'expected/output.txt' : bare}`;
}

/** Refuse anything that is not a relative path, naming the call that received it. */
export function requireRelativePath(call: string, path: unknown): asserts path is string {
    if (typeof path !== 'string' || !isRelativePath(path)) {
        throw new TypeError(
            refusal('b2-relative-path-runtime', {
                fix: `start it with ./ or ../, from the spec file: ${call}('${asRelative(path)}')`,
                found: `${call}(${JSON.stringify(path)}), a path that is not relative to the spec file`,
            }),
        );
    }
}

/**
 * Name one file, by its path from the spec file.
 *
 * @example
 *   await api.seed(file('./seeds/users.sql')).get('/users');
 *   expect(result.stdout).toMatch(file('./expected/help.txt'));
 */
export function file<const Path extends RelativePath>(
    path: Path extends `${string}/` ? never : Path,
): FileAt<Path> {
    requireRelativePath('file', path);
    if (path.endsWith('/')) {
        const bare = path.replace(/\/+$/u, '');
        throw new TypeError(
            refusal('b2-relative-path-runtime', {
                fix: `name the directory with directory(${JSON.stringify(path)}), or the file without its /: file(${JSON.stringify(bare)})`,
                found: `file(${JSON.stringify(path)}), a path ending in / — a directory's`,
            }),
        );
    }
    return diskValue('file', path) as FileAt<Path>;
}

/**
 * The branded value a disk call returns. A string never matches it: handed
 * where a pattern is read — vitest's own `toMatch` on a plain string, with no
 * runner to route it to the golden comparison — it refuses, where a plain
 * object would be read as the pattern `[object Object]` and pass on any text
 * holding one of its letters.
 */
function diskValue(brand: 'directory' | 'file', path: string): object {
    const value = { [DISK]: brand, path };
    Object.defineProperty(value, Symbol.match, {
        value: () => {
            throw new TypeError(
                refusal('d14-one-verb-per-meaning', {
                    fix: `wrap the string to golden it — \`expect(text(value)).toMatch(${brand}(…))\` — or compare it to a value, \`toMatch('…')\``,
                    found: `toMatch(${brand}(${JSON.stringify(path)})) on a string, a value with no golden`,
                }),
            );
        },
    });
    return Object.freeze(value);
}

/**
 * Name one directory, by its path from the spec file — ending in `/`.
 *
 * @example
 *   await cli.fixture(directory('../../shared/fixtures/shop/')).exec('build');
 *   await expect(result.directory('out')).toMatch(directory('./expected/scaffold/'));
 */
export function directory<const Path extends RelativePath<'/'>>(
    path: Path,
): DiskDirectory & { readonly path: Path } {
    requireRelativePath('directory', path);
    if (!path.endsWith('/')) {
        throw new TypeError(
            refusal('b2-relative-path-runtime', {
                fix: `end it in /: directory(${JSON.stringify(`${path}/`)}), or name a file with file(${JSON.stringify(path)})`,
                found: `directory(${JSON.stringify(path)}), a path that does not end in /`,
            }),
        );
    }
    return diskValue('directory', path) as DiskDirectory & {
        readonly path: Path;
    };
}

/** Is this a `file()` value? */
export function isDiskFile(value: unknown): value is DiskFile {
    return brandOf(value) === 'file';
}

/** Is this a `directory()` value? */
export function isDiskDirectory(value: unknown): value is DiskDirectory {
    return brandOf(value) === 'directory';
}

/** Is this a `file()` or a `directory()` value? */
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

/** How a value reads in a refusal: `file('./x')`, or the value itself. */
function spelled(value: unknown): string {
    if (isDiskTarget(value)) {
        return `${brandOf(value)}(${JSON.stringify(value.path)})`;
    }
    return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/**
 * Refuse anything but a `file()` whose path ends in `extension` — a verb that
 * reads one file. The type already does, for a typed caller; this is the same
 * law for a caller the compiler does not see.
 */
export function requireDiskFile(verb: string, value: unknown, extension = ''): DiskFile {
    if (!isDiskFile(value)) {
        throw new TypeError(
            refusal('b2-relative-path-runtime', {
                fix: `name one file: ${verb}(file('./${exampleOf(verb, extension)}'))`,
                found: isDiskDirectory(value)
                    ? `${verb}(${spelled(value)}), a directory where one file is read`
                    : `${verb}(${spelled(value)}), a value where a file is read`,
            }),
        );
    }
    if (!value.path.endsWith(extension)) {
        throw new TypeError(
            refusal('b2-relative-path-runtime', {
                fix: `name the ${extension} file ${verb}() reads: ${verb}(file('./${exampleOf(verb, extension)}'))`,
                found: `${verb}(${spelled(value)}), a file not ending in ${extension}`,
            }),
        );
    }
    return value;
}

/** Refuse anything but a `file()` or a `directory()` — a verb that takes either. */
export function requireDiskTarget(verb: string, value: unknown): DiskTarget {
    if (!isDiskTarget(value)) {
        throw new TypeError(
            refusal('b2-relative-path-runtime', {
                fix: `name the disk: ${verb}(file('./…')) for a file, ${verb}(directory('./…/')) for a directory`,
                found: `${verb}(${spelled(value)}), a value where the disk is read`,
            }),
        );
    }
    return value;
}

/** The example path a refusal shows, in the ground folder the verb reads. */
function exampleOf(verb: string, extension: string): string {
    const folder: Record<string, string> = {
        fixture: 'fixtures/config.json',
        request: 'requests/create.http',
        run: 'case.spec.yaml',
        seed: 'seeds/rows.sql',
    };
    return folder[verb] ?? `expected/output${extension || '.txt'}`;
}
