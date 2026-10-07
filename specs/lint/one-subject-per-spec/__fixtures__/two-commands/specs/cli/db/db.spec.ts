import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('db', () => {
    test('migrates the database', async () => {
        // Given - an empty database
        const result = await cli.exec('db migrate');

        // Then - the whole output
        expect(result.stdout).toMatch(`migrated`);
    });

    test('seeds the database', async () => {
        // Given - a migrated database
        const result = await cli.exec('db seed');

        // Then - the whole output
        expect(result.stdout).toMatch(`seeded`);
    });
});
