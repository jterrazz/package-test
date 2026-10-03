import { readSettings, readSettingsSync } from '@jterrazz/typescript/rules';

import { isRecord } from './json-shape.js';
import type { TestSettings } from './settings.js';

export const TEST_SECTION = 'test';

export type ReadTestSettings = Pick<TestSettings, 'routes'> &
    Required<Pick<TestSettings, 'collections' | 'methodless' | 'production'>>;

export const TEST_DEFAULTS: Readonly<Omit<ReadTestSettings, 'routes'>> = Object.freeze({
    collections: [],
    methodless: [],
    production: { allow: {} },
});

function wordsOf(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
        ? value
        : undefined;
}

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

/** A key of the wrong shape is read as its default, never half-used. */
export function testSettingsOf(test: unknown): ReadTestSettings {
    const section = isRecord(test) ? test : {};
    const allow = isRecord(section.production) ? reasonsOf(section.production.allow) : undefined;
    return {
        collections: wordsOf(section.collections) ?? TEST_DEFAULTS.collections,
        methodless: wordsOf(section.methodless) ?? TEST_DEFAULTS.methodless,
        production: allow === undefined ? TEST_DEFAULTS.production : { allow },
        ...(typeof section.routes === 'string' ? { routes: section.routes } : {}),
    };
}

/** Every pass is sync, so the file is loaded synchronously, once per process; the runtime reads the same resolution, so the run and the checker agree. A file that does not resolve is no settings: the toolchain already reports it. */
export const testSettingsAtSync = (root: string): ReadTestSettings =>
    testSettingsOf(readSettingsSync(root).resolved.sections[TEST_SECTION]);

export async function testSettingsAt(root: string): Promise<ReadTestSettings> {
    const { resolved } = await readSettings(root);
    return testSettingsOf(resolved.sections[TEST_SECTION]);
}
