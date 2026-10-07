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
});
