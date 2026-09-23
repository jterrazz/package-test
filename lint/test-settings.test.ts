import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { testSettingsAt } from './test-settings.js';

/** A unit holding a `jterrazz.config.ts` of this text, or none. */
function unit(config?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'test-settings-'));
    if (config !== undefined) {
        writeFileSync(join(root, 'jterrazz.config.ts'), config);
    }
    return root;
}

describe('the test section of jterrazz.config.ts, as the checker reads it', () => {
    test('the collections a unit declares are read, types stripped', () => {
        // Given - a config typed as a repository writes it
        const root = unit(
            "const collections: readonly string[] = ['data', 'people'];\nexport default { test: { collections } };\n",
        );

        // Then - the section, as declared
        expect(testSettingsAt(root)).toStrictEqual({ collections: ['data', 'people'] });
    });

    test('no file, no section, a key of the wrong shape and a file that does not load are no settings', () => {
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
