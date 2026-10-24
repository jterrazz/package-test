import { describe, expect, test } from 'vitest';

import { lint } from '../lint.project.js';

describe('lint', () => {
    test('lint() — the lint project — collects the lint specs under its own name', () => {
        // Given - the lint project, as declared and with options of its own
        const declared = lint().test;
        const narrowed = lint({ include: ['specs/lint/x/**/*.spec.ts'] }).test;

        // Then - its name and the specs it collects
        expect([declared?.name, declared?.include, narrowed?.include]).toStrictEqual([
            'lint',
            ['specs/lint/**/*.spec.ts'],
            ['specs/lint/x/**/*.spec.ts'],
        ]);
    });

    test('lint() — the lint project — shares one module graph per worker when the project says so, and isolates otherwise', () => {
        // Given - a lint project whose specs keep no state in a module, and one stated by nobody
        const shared = lint({ isolate: false }).test;

        // Then - the first runs its files in one graph per worker, the other is vitest's default
        expect(shared?.isolate).toBe(false);
        expect(lint().test).not.toHaveProperty('isolate');
    });
});
