import { describe, expect, test } from 'vitest';

import { testPreset } from './preset.js';

describe('preset', () => {
    test('testPreset — the test preset — hands on its standard as written — the defaults of the test section, beside the file they come from', () => {
        // Given - the preset a repository lists
        const preset = testPreset();

        // Then - its section's defaults are the standard's, named by their file
        const defaults = { collections: [], methodless: [], production: { allow: {} } };
        expect([preset.name, preset.package, preset.settings, preset.origins]).toStrictEqual([
            'test',
            '@jterrazz/test',
            defaults,
            [{ file: 'src/standard/standard.ts', settings: defaults }],
        ]);
    });
});
