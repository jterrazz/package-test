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
export function testSettingsOf(test: unknown): TestSettings {
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
