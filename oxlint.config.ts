import { oxlint } from '@jterrazz/typescript';
import { defineConfig } from 'oxlint';

// Self-lint with our own plugin (the tool-facing lint layer under src/lint/),
// Loaded from the built bundle. Node's TS type-stripping does not resolve
// `.js` specifiers to `.ts` sources, so `npm run build` must precede lint.
import { recommendedRules } from './dist/oxlint.js';

export default defineConfig({
    extends: [oxlint.node],
    ignorePatterns: ['specs/**/fixtures/**'],
    jsPlugins: ['./dist/oxlint.js'],
    overrides: [
        {
            // The framework's own module tests unit-test the constructors —
            // Creating runners (and exercising the mode option) outside a
            // *.specification.ts file is their purpose.
            files: ['src/**/*.test.ts'],
            rules: {
                'jterrazz/a1-specification-file': 'off',
                'jterrazz/a5-mode-with-server': 'off',
            },
        },
        {
            // The vitest layer IS the sanctioned runner coupling (I1) — its
            // `vitest` imports are the framework's own seam, not prod leakage.
            files: ['src/vitest/**'],
            rules: { 'jterrazz/f2-no-test-imports-in-prod': 'off' },
        },
    ],
    rules: {
        'import/exports-last': 'off',
        ...recommendedRules,
        // Docker-aware runner names used across specs (CONVENTIONS B5).
        'jterrazz/b5-await-using': ['error', { runners: ['dockerCli'] }],
    },
});
