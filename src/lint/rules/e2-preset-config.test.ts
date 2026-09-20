import { asOxlintRule, ruleTester } from '../rule-tester.fixtures.js';
import { e2PresetConfig } from './e2-preset-config.js';

const CONFIG = '/repo/vitest.config.ts';

ruleTester().run('e2-preset-config', asOxlintRule(e2PresetConfig), {
    invalid: [
        // Vitest's own helper: none of the preset's defaults.
        {
            code: `export default defineConfig({ test: { projects: [] } });`,
            errors: [{ messageId: 'offPreset' }],
            filename: CONFIG,
        },
        // A bare object default-export.
        {
            code: `export default { test: { include: ['src/**/*.test.ts'] } };`,
            errors: [{ messageId: 'offPreset' }],
            filename: CONFIG,
        },
        // Through an identifier, which resolves to the wrong call.
        {
            code: `const config = defineConfig({}); export default config;`,
            errors: [{ messageId: 'offPreset' }],
            filename: CONFIG,
        },
    ],
    valid: [
        // The preset, directly.
        {
            code: `export default defineSpecConfig({ test: { projects: [unit()] } });`,
            filename: CONFIG,
        },
        // Through a typed identifier — the same config, spelled for the compiler.
        {
            code: `const config = defineSpecConfig({}) satisfies UserConfig; export default config;`,
            filename: CONFIG,
        },
        // With the annotation on the export itself.
        {
            code: `export default defineSpecConfig({}) satisfies UserConfig;`,
            filename: CONFIG,
        },
        // Layered with vitest's own merge — what it layers over is the preset.
        {
            code: `export default mergeConfig(defineSpecConfig({}), { test: { pool: 'forks' } });`,
            filename: CONFIG,
        },
        // Not a config: out of reach by role.
        { code: `export default defineConfig({});`, filename: '/repo/vite.config.ts' },
    ],
});
