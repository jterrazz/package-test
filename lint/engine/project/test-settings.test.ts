import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { testSectionAt, testSettingsAt } from './test-settings.js';

function unit(config?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'test-settings-'));
    if (config !== undefined) {
        writeFileSync(join(root, 'jterrazz.config.ts'), config);
    }
    return root;
}

const DEFAULTS = { collections: [], methodless: [], production: { allow: {} } };

describe('test-settings', () => {
    test('the test section of jterrazz.config.ts, as the checker reads it — the collections a unit declares are read, types stripped', () => {
        // Given - a config typed as a repository writes it
        const root = unit(
            "const collections: readonly string[] = ['data', 'people'];\nexport default { test: { collections } };\n",
        );

        // Then - the section, as declared
        expect(testSettingsAt(root)).toStrictEqual({
            collections: ['data', 'people'],
            methodless: [],
            production: { allow: {} },
        });
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — the method-less routes a unit declares are read', () => {
        // Given - a unit whose api takes any method on /mcp
        const root = unit("export default { test: { methodless: ['/mcp'] } };\n");

        // Then - the paths, as declared
        expect(testSettingsAt(root)).toStrictEqual({
            collections: [],
            methodless: ['/mcp'],
            production: { allow: {} },
        });
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — the test packages production runs are read with their reasons', () => {
        // Given - a unit whose service drives a browser
        const root = unit(
            "export default { test: { production: { allow: { playwright: 'the gate drives a browser in production' } } } };\n",
        );

        // Then - the allow list, reasons and all
        expect(testSettingsAt(root)).toStrictEqual({
            collections: [],
            methodless: [],
            production: { allow: { playwright: 'the gate drives a browser in production' } },
        });
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — an allowed package with no reason leaves the whole list unread', () => {
        // Given - one package stated without the sentence that says why
        const root = unit(
            "export default { test: { production: { allow: { playwright: 'drives a browser', vitest: '' } } } };\n",
        );

        // Then - nothing is allowed
        expect(testSettingsAt(root)).toStrictEqual(DEFAULTS);
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — no file, no section, a key of the wrong shape and a file that does not load are no settings', () => {
        // Given - four units the reading finds nothing usable in
        const roots = [
            unit(),
            unit('export default { typescript: { roots: {} } };\n'),
            unit("export default { test: { collections: 'data' } };\n"),
            unit("throw new Error('broken');\n"),
        ];

        // Then - each reads as the defaults
        expect(roots.map((root) => testSettingsAt(root))).toStrictEqual([
            DEFAULTS,
            DEFAULTS,
            DEFAULTS,
            DEFAULTS,
        ]);
    });

    test('the test section of jterrazz.config.ts, as the run reads it — the routes document and the method-less paths a member declares are read, types stripped', async () => {
        // Given - a member declaring an OpenAPI document and one method-less route
        const root = unit(
            "const routes: string = './openapi.yaml';\nexport default { test: { methodless: ['/mcp'], routes } };\n",
        );

        // Then - both reach the run as declared
        await expect(testSectionAt(root)).resolves.toStrictEqual({
            collections: [],
            methodless: ['/mcp'],
            production: { allow: {} },
            routes: './openapi.yaml',
        });
    });

    test('the test section of jterrazz.config.ts, as the run reads it — no file, and a key of the wrong shape, are no settings', async () => {
        // Given - a unit with no config, and one whose routes is not a path
        const roots = [unit(), unit('export default { test: { routes: 42 } };\n')];

        // Then - neither declares anything the run would half-use
        await expect(Promise.all(roots.map(testSectionAt))).resolves.toStrictEqual([
            DEFAULTS,
            DEFAULTS,
        ]);
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — a unit declaring a preset reads its settings under its own', () => {
        // Given - a preset of the `test` section setting a default, and the unit adding to it
        const preset = {
            name: 'test',
            package: '@jterrazz/test',
            settings: { collections: ['data'], methodless: [], production: { allow: {} } },
        };
        const root = unit(
            `export default { presets: [${JSON.stringify(preset)}], test: { collections: ['people'] } };\n`,
        );

        // Then - the preset's default and the unit's own addition, merged
        expect(testSettingsAt(root)).toStrictEqual({
            collections: ['data', 'people'],
            methodless: [],
            production: { allow: {} },
        });
    });
});
