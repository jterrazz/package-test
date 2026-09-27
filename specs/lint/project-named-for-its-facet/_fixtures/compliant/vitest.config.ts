import { defineSpecConfig } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            { include: ['specs/api/**/*.spec.ts'], name: 'api' }, // oxlint-disable-line jterrazz/include-points-at-a-folder -- an input tree of the project-named-for-its-facet spec: this rule is incidental to the one it feeds
            // The package root is what bounds the search for a specs tree: this
            // Fixture lives under one, and `unit` still collects its own `src/`.
            { include: ['src/**/*.test.ts'], name: 'unit' }, // oxlint-disable-line jterrazz/include-points-at-a-folder -- an input tree of the project-named-for-its-facet spec: this rule is incidental to the one it feeds
        ],
    },
});
