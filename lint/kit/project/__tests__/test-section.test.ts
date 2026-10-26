import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    listsTestPreset,
    testSettingsAt,
    testSettingsAtSync,
    testSettingsOf,
} from '../test-section.js';

function unit(config?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'test-section-'));
    if (config !== undefined) {
        writeFileSync(join(root, 'studio.config.ts'), config);
    }
    return root;
}

const DEFAULTS = { collections: [], methodless: [], production: { allow: {} } };

describe('test-section', () => {
    test('the test section of studio.config.ts, as the checker reads it — the collections a unit declares are read, types stripped', () => {
        // Given - a config typed as a repository writes it
        const root = unit(
            "const collections: readonly string[] = ['data', 'people'];\nexport default { test: { collections } };\n",
        );

        // Then - the section, as declared
        expect(testSettingsAtSync(root)).toStrictEqual({
            collections: ['data', 'people'],
            methodless: [],
            production: { allow: {} },
        });
    });

    test('the test section of studio.config.ts, as the checker reads it — the method-less routes a unit declares are read', () => {
        // Given - a unit whose api takes any method on /mcp
        const root = unit(
            "export default { test: { methodless: { '/mcp': 'the transport answers GET and POST' } } };\n",
        );

        // Then - the paths, as declared
        expect(testSettingsAtSync(root)).toStrictEqual({
            collections: [],
            methodless: ['/mcp'],
            production: { allow: {} },
        });
    });

    test('the test section of studio.config.ts, as the checker reads it — the test packages production runs are read with their reasons', () => {
        // Given - a unit whose service drives a browser
        const root = unit(
            "export default { test: { production: { allow: { playwright: 'the gate drives a browser in production' } } } };\n",
        );

        // Then - the allow list, reasons and all
        expect(testSettingsAtSync(root)).toStrictEqual({
            collections: [],
            methodless: [],
            production: { allow: { playwright: 'the gate drives a browser in production' } },
        });
    });

    test('the test section of studio.config.ts, as the checker reads it — an allowed package with no reason leaves the whole list unread', () => {
        // Given - one package stated without the sentence that says why
        const root = unit(
            "export default { test: { production: { allow: { playwright: 'drives a browser', vitest: '' } } } };\n",
        );

        // Then - nothing is allowed
        expect(testSettingsAtSync(root)).toStrictEqual(DEFAULTS);
    });

    test('the test section of studio.config.ts, as the checker reads it — no file, no section, a key of the wrong shape and a file that does not load are no settings', () => {
        // Given - four units the reading finds nothing usable in
        const roots = [
            unit(),
            unit('export default { typescript: { roots: {} } };\n'),
            unit("export default { test: { collections: 'data' } };\n"),
            unit("throw new Error('broken');\n"),
        ];

        // Then - each reads as the defaults
        expect(roots.map((root) => testSettingsAtSync(root))).toStrictEqual([
            DEFAULTS,
            DEFAULTS,
            DEFAULTS,
            DEFAULTS,
        ]);
    });

    test('the test section of studio.config.ts, as the run reads it — the routes document and the method-less paths a member declares are read, types stripped', async () => {
        // Given - a member declaring an OpenAPI document and one method-less route
        const root = unit(
            "const routes: string = './openapi.yaml';\nexport default { test: { methodless: { '/mcp': 'the transport answers GET and POST' }, routes } };\n",
        );

        // Then - both reach the run as declared
        await expect(testSettingsAt(root)).resolves.toStrictEqual({
            collections: [],
            methodless: ['/mcp'],
            production: { allow: {} },
            routes: './openapi.yaml',
        });
    });

    test('the test section of studio.config.ts, as the run reads it — no file, and a key of the wrong shape, are no settings', async () => {
        // Given - a unit with no config, and one whose routes is not a path
        const roots = [unit(), unit('export default { test: { routes: 42 } };\n')];

        // Then - neither declares anything the run would half-use
        await expect(Promise.all(roots.map(testSettingsAt))).resolves.toStrictEqual([
            DEFAULTS,
            DEFAULTS,
        ]);
    });

    test('the test section of studio.config.ts, as the checker reads it — a unit declaring a preset reads its settings under its own', () => {
        // Given - a preset of the `test` section setting a default, and the unit adding to it
        const preset = {
            name: 'test',
            package: '@jterrazz/test',
            settings: { collections: ['data'], methodless: {}, production: { allow: {} } },
        };
        const root = unit(
            `export default { presets: [${JSON.stringify(preset)}], test: { collections: ['people'] } };\n`,
        );

        // Then - the preset's default and the unit's own addition, merged
        expect(testSettingsAtSync(root)).toStrictEqual({
            collections: ['data', 'people'],
            methodless: [],
            production: { allow: {} },
        });
    });

    test('the test section, read value by value — a list holding one word of another type, a reason list that is no map or holds a blank reason, and a section that is no map are each their default', () => {
        // Given - sections whose every key is half right
        const sections = [
            { collections: ['data', 1], methodless: ['/mcp'] },
            { methodless: { '/mcp': ' ' } },
            { production: { allow: 'playwright' } },
            { production: { allow: { playwright: '   ' } } },
            { production: { allow: { playwright: true } } },
            { production: null },
            { basePath: ['/api'] },
            { basePath: 42 },
            ['collections'],
            null,
        ];

        // Then - each reads as the defaults
        expect(sections.map((section) => testSettingsOf(section))).toStrictEqual(
            sections.map(() => DEFAULTS),
        );
    });

    test('the test section — a base path is read where it is a path of segments, from the root', () => {
        // Given - a mount of one segment, and one of two
        // Then - each is read as written
        expect(
            [{ basePath: '/api' }, { basePath: '/v1/public' }].map(
                (section) => testSettingsOf(section).basePath,
            ),
        ).toStrictEqual(['/api', '/v1/public']);
    });

    test('the test section — a base path no route can be mounted under is refused, naming the shape it takes', () => {
        // Given - a mount with no leading slash, one of two such segments, one ending in a slash, and one in capitals
        const refused = ['api', 'api/v1', '/api/', '/API'].map((basePath) => {
            try {
                return testSettingsOf({ basePath }).basePath;
            } catch (error) {
                return error instanceof Error ? error.message : String(error);
            }
        });

        // Then - each is refused as written, never read as no base path, with the shape it takes
        expect(refused.map((message) => message?.split('\n')[0])).toStrictEqual([
            'found: studio.config.ts: test.basePath "api" is no mount path',
            'found: studio.config.ts: test.basePath "api/v1" is no mount path',
            'found: studio.config.ts: test.basePath "/api/" is no mount path',
            'found: studio.config.ts: test.basePath "/API" is no mount path',
        ]);
        expect(refused[2]).toBe(
            [
                'found: studio.config.ts: test.basePath "/api/" is no mount path',
                'why: The base path is cut from every route before its subject folder is derived, so it is read as a route prefix is written: one leading slash, lowercase segments, no trailing slash.',
                "fix: write the path the routes are mounted under from the root, with no slash at its end: test: { basePath: '/api' }",
                'read: docs/reference/linting.md#test-settings-section',
            ].join('\n'),
        );
    });

    test("listsTestPreset — whether a unit's checker judges its trees — is the unit listing this package's preset, beside others or alone", () => {
        // Given - a unit listing this package's preset beside another, one listing another package's, and one listing none
        const listing = unit(
            "export default { presets: [{ name: 'other', package: '@acme/other' }, { name: 'test', package: '@jterrazz/test' }] };\n",
        );
        const foreign = unit(
            "export default { presets: [{ name: 'test', package: '@acme/test' }] };\n",
        );

        // Then - only the first lists it
        expect([listing, foreign, unit()].map((root) => listsTestPreset(root))).toStrictEqual([
            true,
            false,
            false,
        ]);
    });
});
