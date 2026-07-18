import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { specification, sqlite } from '../../../../index.js';

const CLI_BIN = resolve(import.meta.dirname, '../../../../../specs/fixtures/cli-app/cli.sh');

// Given - a runner with exactly ONE database in the services record
const { cleanup, cli } = await specification.cli(CLI_BIN, {
    services: { db: sqlite() },
});

afterAll(cleanup);

describe('database option rule (CONVENTIONS A7)', () => {
    test('with a single database, passing database is redundant and throws', () => {
        // Given - one declared database ("db")
        // Then - the explicit option is rejected as redundant, synchronously
        expect(() => cli.seed('anything.sql', { database: 'db' })).toThrow(
            'seed(): redundant database option — "db" is the only declared database.',
        );
    });

    test('with a single database, table() rejects the option too', async () => {
        // Given - any executed spec
        const result = await cli.exec('help');

        // Then - table() with a database option violates A7
        expect(() => result.table('t', { database: 'db' })).toThrow(
            'table(): redundant database option — "db" is the only declared database.',
        );
    });

    test('with a single database, omitting the option is valid', async () => {
        // Given - any executed spec
        const result = await cli.exec('help');

        // Then - table() without the option resolves the lone database
        expect(() => result.table('t')).not.toThrow();
    });
});
