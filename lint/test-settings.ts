import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import type { TestSettings } from '../src/kernel/config/settings.js';
import { testSettingsOf } from '../src/kernel/config/test-section.js';

/**
 * The `test` section of a unit's `jterrazz.config.ts`, as the conventions
 * checker reads it. Node loads the file itself, types stripped — the loading
 * `@jterrazz/typescript` does for its own section — but synchronously, since
 * every pass is: `require()` of an ES module with no top-level await. What
 * the loaded module says is read by the runtime's own reader
 * (`kernel/config/test-section.ts`), so the run and the checker never
 * disagree on the shape of a key; only the loading is the checker's.
 *
 * A missing file, or one that does not load, is no settings: the toolchain's
 * own reading of the same file reports a file that does not load, and a
 * second report here would name one defect twice. A key of the wrong shape
 * is read as absent, never half-used.
 */

/** What the checker reads of the section — the section `TestSettings` declares. */
export type CheckerSettings = TestSettings;

const loadModule = createRequire(import.meta.url);

/** The sections read so far, by the file they came from: Node loads a module once per process. */
const read = new Map<string, CheckerSettings>();

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
        settings = testSettingsOf(loadModule(path));
    } catch {
        settings = {};
    }
    read.set(path, settings);
    return settings;
}
