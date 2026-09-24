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
    /** The api routes that take any method, by their path — `TestSettings.methodless`. */
    methodless?: readonly string[];
    /** The test packages production runs, each with its reason — `TestSettings.production`. */
    production?: { allow: Readonly<Record<string, string>> };
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

/** Package names, each with the sentence that says why — or nothing, when one has none. */
function reasonsOf(value: unknown): Record<string, string> | undefined {
    if (!isRecord(value)) {
        return undefined;
    }
    const reasons: Record<string, string> = {};
    for (const [name, reason] of Object.entries(value)) {
        if (typeof reason !== 'string' || reason.trim() === '') {
            return undefined;
        }
        reasons[name] = reason;
    }
    return reasons;
}

/** The section's keys a pass reads, each kept only in the shape it is declared in. */
function checkerSettingsOf(test: unknown): CheckerSettings {
    if (!isRecord(test)) {
        return {};
    }
    const collections = wordsOf(test.collections);
    const methodless = wordsOf(test.methodless);
    const allow = isRecord(test.production) ? reasonsOf(test.production.allow) : undefined;
    return {
        ...(collections === undefined ? {} : { collections }),
        ...(methodless === undefined ? {} : { methodless }),
        ...(allow === undefined ? {} : { production: { allow } }),
    };
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
        settings = checkerSettingsOf(isRecord(config) ? config.test : undefined);
    } catch {
        settings = {};
    }
    read.set(path, settings);
    return settings;
}
