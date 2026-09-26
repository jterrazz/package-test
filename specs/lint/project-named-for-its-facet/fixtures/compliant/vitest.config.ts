import { defineSpecConfig } from '@jterrazz/test/vitest';

export default defineSpecConfig({
    test: {
        projects: [
            { include: ['specs/api/**/*.spec.ts'], name: 'api' },
            // The package root is what bounds the search for a specs tree: this
            // Fixture lives under one, and `unit` still collects its own `src/`.
            { include: ['src/**/*.test.ts'], name: 'unit' },
        ],
    },
});
