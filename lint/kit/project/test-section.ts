import { readSettings, readSettingsSync, refusalBlock } from '@jterrazz/typescript/rules';

import { isRecord } from './json-shape.js';
import type { TestSettings } from './settings.js';

export const TEST_SECTION = 'test';

export type ReadTestSettings = Pick<TestSettings, 'basePath' | 'routes'> &
    Required<Pick<TestSettings, 'collections' | 'production'>> & {
        /** The paths of the routes taken on any method; their reasons are the settings file's. */
        methodless: readonly string[];
    };

const UNREAD: Readonly<Omit<ReadTestSettings, 'basePath' | 'routes'>> = Object.freeze({
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

const BASE_PATH = /^(?:\/[a-z0-9][\w.~-]*)+$/u;

// invariant: a base path the type lets through but no route can be mounted under is refused, never read as no base path: every route would be filed under it again, silently.
const isMountPath = (value: string): value is `/${string}` => BASE_PATH.test(value);

function basePathOf(value: unknown): `/${string}` | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    if (!isMountPath(value)) {
        throw new Error(
            refusalBlock({
                fix: "write the path the routes are mounted under from the root, with no slash at its end: test: { basePath: '/api' }",
                found: `jterrazz.config.ts: test.basePath ${JSON.stringify(value)} is no mount path`,
                read: 'docs/reference/linting.md#test-settings-section',
                why: 'The base path is cut from every route before its subject folder is derived, so it is read as a route prefix is written: one leading slash, lowercase segments, no trailing slash.',
            }),
        );
    }
    return value;
}

/** A key of the wrong shape is read as its default, never half-used: the type check refuses it first; a base path the type lets through and no route can carry is refused here. */
export function testSettingsOf(test: unknown): ReadTestSettings {
    const section = isRecord(test) ? test : {};
    const allow = isRecord(section.production) ? reasonsOf(section.production.allow) : undefined;
    const basePath = basePathOf(section.basePath);
    return {
        collections: wordsOf(section.collections) ?? UNREAD.collections,
        methodless: Object.keys(reasonsOf(section.methodless) ?? {}),
        production: allow === undefined ? UNREAD.production : { allow },
        ...(typeof section.routes === 'string' ? { routes: section.routes } : {}),
        ...(basePath === undefined ? {} : { basePath }),
    };
}

/** Every pass is sync, so the file is loaded synchronously, once per process; the runtime reads the same resolution, so the run and the checker agree. A file that does not resolve is no settings: the toolchain already reports it. */
export const testSettingsAtSync = (root: string): ReadTestSettings =>
    testSettingsOf(readSettingsSync(root).resolved.sections[TEST_SECTION]);

/** Whether the unit's settings list this package's preset, the one whose checker judges every specs tree under it. */
export const listsTestPreset = (root: string): boolean =>
    readSettingsSync(root).resolved.presets.some((preset) => preset.package === '@jterrazz/test');

export async function testSettingsAt(root: string): Promise<ReadTestSettings> {
    const { resolved } = await readSettings(root);
    return testSettingsOf(resolved.sections[TEST_SECTION]);
}
