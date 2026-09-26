import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { TestSettings } from './settings.js';

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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

/** A key of the wrong shape is read as absent, never half-used. */
export function testSettingsOf(loaded: unknown): TestSettings {
    const config = isRecord(loaded) ? loaded.default : undefined;
    const test = isRecord(config) ? config.test : undefined;
    if (!isRecord(test)) {
        return {};
    }
    const collections = wordsOf(test.collections);
    const methodless = wordsOf(test.methodless);
    const allow = isRecord(test.production) ? reasonsOf(test.production.allow) : undefined;
    const routes = typeof test.routes === 'string' ? test.routes : undefined;
    return {
        ...(collections === undefined ? {} : { collections }),
        ...(methodless === undefined ? {} : { methodless }),
        ...(allow === undefined ? {} : { production: { allow } }),
        ...(routes === undefined ? {} : { routes }),
    };
}

export async function testSectionAt(root: string): Promise<TestSettings> {
    const path = join(root, 'jterrazz.config.ts');
    if (!existsSync(path)) {
        return {};
    }
    const loaded: unknown = await import(pathToFileURL(path).href);
    return testSettingsOf(loaded);
}
