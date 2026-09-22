/**
 * A path a spec names a file by, spelled relative to the spec file itself.
 *
 * Every verb that reads the disk takes one, and nothing else: the path leaves
 * no folder implied and no pool hidden behind a marker, so what a test stands
 * on is visible on the line that names it. `Extension` narrows the tail — a
 * seed ends in `.sql`, a directory in `/`.
 */
export type RelativePath<Extension extends string = string> =
    | `../${string}${Extension}`
    | `./${string}${Extension}`;

/** Does the value start the way a relative path must? */
export function isRelativePath(value: string): boolean {
    return value.startsWith('./') || value.startsWith('../');
}

/**
 * Refuse anything that is not a relative path. The type already does, for a
 * typed caller; this is the same law for a caller the compiler does not see.
 */
export function requireRelativePath(verb: string, path: unknown): asserts path is string {
    if (typeof path !== 'string' || !isRelativePath(path)) {
        throw new TypeError(
            `${verb}(${JSON.stringify(path)}): a file is named by a path relative to the spec file — ` +
                `start it with ./ or ../ (e.g. ${verb}('./expected/output.txt')).`,
        );
    }
}
