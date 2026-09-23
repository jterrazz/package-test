import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * The `test` section of a unit's `jterrazz.config.ts`, as the conventions
 * checker reads it. Node loads the file itself, types stripped — the loading
 * `@jterrazz/typescript` does for its own section — but synchronously, since
 * every pass is: `require()` of an ES module with no top-level await.
 *
 * A missing file, or one that does not load, is no settings: the toolchain's
 * own reading of the same file reports a file that does not load, and a
 * second report here would name one defect twice. A key of the wrong shape
 * is read as absent, never half-used.
 */

/**
 * What the checker reads of the section — the keys of `TestSettings` a pass
 * judges by. The `lint/` layer imports nothing of `src/`, so the shape is
 * stated here; `test-settings.test.ts` loads a config the settings type
 * accepts.
 */
export type CheckerSettings = {
    /** The api collections no plural names — `TestSettings.collections`. */
    collections?: readonly string[];
};

const loadModule = createRequire(import.meta.url);

/** The sections read so far, by the file they came from: Node loads a module once per process. */
const read = new Map<string, CheckerSettings>();

/** A plain object — never an array, never null. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A list of strings, or nothing. */
function wordsOf(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
        ? value
        : undefined;
}

/** The `test` section the unit at `root` declares — `{}` when it declares none. */
export function testSettingsAt(root: string): CheckerSettings {
    const path = join(root, 'jterrazz.config.ts');
    if (!existsSync(path)) {
        return {};
    }
    const known = read.get(path);
    if (known !== undefined) {
        return known;
    }
    let settings: CheckerSettings = {};
    try {
        const loaded: unknown = loadModule(path);
        const config = isRecord(loaded) ? loaded.default : undefined;
        const test = isRecord(config) ? config.test : undefined;
        const collections = isRecord(test) ? wordsOf(test.collections) : undefined;
        settings = collections === undefined ? {} : { collections };
    } catch {
        settings = {};
    }
    read.set(path, settings);
    return settings;
}
