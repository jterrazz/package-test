import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { testSettingsAt } from './test-settings.js';

function unit(config?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'test-settings-'));
    if (config !== undefined) {
        writeFileSync(join(root, 'jterrazz.config.ts'), config);
    }
    return root;
}

describe('testSettingsAt', () => {
    test('the test section of jterrazz.config.ts, as the checker reads it — the collections a unit declares are read, types stripped', () => {
        // Given - a config typed as a repository writes it
        const root = unit(
            "const collections: readonly string[] = ['data', 'people'];\nexport default { test: { collections } };\n",
        );

        // Then - the section, as declared
        expect(testSettingsAt(root)).toStrictEqual({ collections: ['data', 'people'] });
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — the method-less routes a unit declares are read', () => {
        // Given - a unit whose api takes any method on /mcp
        const root = unit("export default { test: { methodless: ['/mcp'] } };\n");

        // Then - the paths, as declared
        expect(testSettingsAt(root)).toStrictEqual({ methodless: ['/mcp'] });
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — the test packages production runs are read with their reasons', () => {
        // Given - a unit whose service drives a browser
        const root = unit(
            "export default { test: { production: { allow: { playwright: 'the gate drives a browser in production' } } } };\n",
        );

        // Then - the allow list, reasons and all
        expect(testSettingsAt(root)).toStrictEqual({
            production: { allow: { playwright: 'the gate drives a browser in production' } },
        });
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — an allowed package with no reason leaves the whole list unread', () => {
        // Given - one package stated without the sentence that says why
        const root = unit(
            "export default { test: { production: { allow: { playwright: 'drives a browser', vitest: '' } } } };\n",
        );

        // Then - nothing is allowed
        expect(testSettingsAt(root)).toStrictEqual({});
    });

    test('the test section of jterrazz.config.ts, as the checker reads it — no file, no section, a key of the wrong shape and a file that does not load are no settings', () => {
        // Given - four units the reading finds nothing usable in
        const roots = [
            unit(),
            unit('export default { typescript: { roots: {} } };\n'),
            unit("export default { test: { collections: 'data' } };\n"),
            unit("throw new Error('broken');\n"),
        ];

        // Then - each reads as no settings at all
        expect(roots.map((root) => testSettingsAt(root))).toStrictEqual([{}, {}, {}, {}]);
    });
});
