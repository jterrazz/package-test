import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import type { TestSettings } from '../src/kernel/config/settings.js';
import { testSettingsOf } from '../src/kernel/config/test-section.js';

/** Node loads the file synchronously, types stripped, since every pass is sync; the runtime's reader reads it, so the run and the checker agree. A file that does not load is no settings: the toolchain already reports it. */

export type CheckerSettings = TestSettings;

const loadModule = createRequire(import.meta.url);

/** Node loads a module once per process. */
const read = new Map<string, CheckerSettings>();

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
