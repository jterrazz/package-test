import { describe, expect, test } from 'vitest';

import { deployment } from '../deployment.project.js';

describe('deployment', () => {
    test('deployment() — the deployment project — collects the deployment specs under its own name', () => {
        // Given - the project, as derived and with options of its own
        const derived = deployment().test;
        const narrowed = deployment({ include: ['specs/deployment/edge/**/*.spec.ts'] }).test;

        // Then - its name and the specs it collects
        expect([derived?.name, derived?.include, narrowed?.include]).toStrictEqual([
            'deployment',
            ['specs/deployment/**/*.spec.ts'],
            ['specs/deployment/edge/**/*.spec.ts'],
        ]);
    });
});
