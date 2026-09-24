import { resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { file, specification, sqlite } from '../../index.js';

const CLI_BIN = resolve(import.meta.dirname, '../../../specs/shared/fixtures/cli-app/cli.sh');

// Given - a runner with exactly ONE database in the services record
const { cleanup, cli } = await specification.cli(CLI_BIN, {
    services: { db: sqlite() },
});

afterAll(cleanup);

describe('database option rule (CONVENTIONS A7)', () => {
    test('with a single database, passing database is redundant and throws', () => {
        // Given - one declared database ("db")
        // Then - the explicit option is rejected as redundant, synchronously
        // checker-disable-next-line c8 -- the A7 refusal fires before the seed is read: the path names nothing on purpose
        expect(() => cli.seed(file('./seeds/anything.sql'), { database: 'db' })).toThrow(
            'found: seed() names a database, and "db" is the only one declared',
        );
    });

    test('with a single database, table() rejects the option too', async () => {
        // Given - any executed spec
        const result = await cli.exec('help');

        // Then - table() with a database option violates A7
        expect(() => result.table('t', { database: 'db' })).toThrow(
            'found: table() names a database, and "db" is the only one declared',
        );
    });

    test('with a single database, omitting the option is valid', async () => {
        // Given - any executed spec
        const result = await cli.exec('help');

        // Then - table() without the option resolves the lone database
        expect(() => result.table('t')).not.toThrow();
    });
});
