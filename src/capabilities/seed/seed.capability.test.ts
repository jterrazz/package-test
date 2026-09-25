import { describe, expect, test } from 'vitest';

import { defineFacet } from '../../facets/define-facet.js';
import { defineAction } from '../../model/chain/action.js';
import type { SpecificationConfig } from '../../model/chain/config.js';
import { directory, file } from '../../model/chain/spec-path.js';
import type { DatabasePort } from '../../model/ports/database.port.js';
import { seed } from './seed.capability.js';
import type { SeedMethod } from './seed.capability.js';
import type { SeedPort } from './seed.port.js';

/** A chain composed of `.seed()` alone, ending on an action that does nothing. */
type Chain = { seed: SeedMethod<Chain, string>; settle: () => Promise<null> };

const settle = defineAction({
    accessors: [],
    name: 'settle',
    perform: async () => await Promise.resolve(null),
    row: { group: 'Terminal action', name: '.settle()', probe: '.settle(' },
});

/** A database that logs what it is told under `name`. */
function logging(log: string[], name: string): DatabasePort {
    return {
        columns: async () => await Promise.resolve([]),
        query: async () => await Promise.resolve([]),
        reset: async () => {
            log.push(`reset ${name}`);
            await Promise.resolve();
        },
        seed: async (sql) => {
            log.push(`${name} ← ${sql}`);
            await Promise.resolve();
        },
    };
}

/** A chain over two logged databases, reading every seed file as its own path. */
function chainOver(log: string[], config: SpecificationConfig): Chain {
    const databases: SeedPort = {
        read: (path, testDir) => `${testDir}/${path}`,
        reset: async () => {
            log.push('reset');
            await Promise.resolve();
        },
        target: (database) => logging(log, database ?? 'the only one'),
    };
    return defineFacet<Chain>()({
        actions: [settle],
        capabilities: [seed],
        engines: () => ({ databases }),
        locate: () => '/specs/users',
        options: {},
    }).open(config);
}

describe('.seed() — the SQL files a chain runs first', () => {
    test('empties the databases, then runs each file against the one it names, in order', async () => {
        // Given - a chain seeding two databases
        const log: string[] = [];
        const chain = chainOver(log, { databaseKeys: ['analytics', 'db'] });

        // When - the chain is armed
        await chain
            // checker-disable-next-line c8 -- the engine is a double that echoes the path it would read: no file is opened
            .seed(file('./seeds/users.sql'), { database: 'db' })
            // checker-disable-next-line c8 -- the engine is a double that echoes the path it would read: no file is opened
            .seed(file('./seeds/events.sql'), { database: 'analytics' })
            .settle();

        // Then - one reset, then each file where it was sent, read from the test's directory
        expect(log).toStrictEqual([
            'reset',
            'db ← /specs/users/./seeds/users.sql',
            'analytics ← /specs/users/./seeds/events.sql',
        ]);
    });

    test('empties the databases even when the chain seeds nothing', async () => {
        // Given - a chain that states no seed
        const log: string[] = [];

        // When - it is armed
        await chainOver(log, {}).settle();

        // Then - the databases start empty all the same
        expect(log).toStrictEqual(['reset']);
    });

    test('refuses an unnamed seed when two databases are declared, as it is stated (A7)', () => {
        // Given - two databases declared
        const chain = chainOver([], { databaseKeys: ['analytics', 'db'] });

        // Then - the seed is refused before any chain is armed
        // checker-disable-next-line c8 -- the refusal under test fires before the seed is read: the path names nothing on purpose
        expect(() => chain.seed(file('./seeds/users.sql'))).toThrow('2 databases are declared');
    });

    test('refuses what is not one .sql file, naming file()', () => {
        // Given - a caller the compiler does not see
        const chain = chainOver([], {});

        // Then - a path or a statement as a value, a directory and another extension are each refused as stated
        expect(() => chain.seed('./seeds/rows.sql' as never)).toThrow(
            /^found: seed\("\.\/seeds\/rows\.sql"\), a value where a file is read\n.*\nfix: name one file: seed\(file\(/u,
        );
        expect(() => chain.seed("INSERT INTO users (name) VALUES ('Ada');" as never)).toThrow(
            /^found: seed\("INSERT INTO users \(name\) VALUES \('Ada'\);"\), a value where a file is read\n.*\nfix: name one file: seed\(file\('\.\/seeds\/rows\.sql'\)\)\n/u,
        );
        // checker-disable-next-line c8 -- the refusal under test fires before the seed is read: the path names nothing on purpose
        expect(() => chain.seed(directory('./seeds/') as never)).toThrow(
            /a directory where one file is read/u,
        );
        // checker-disable-next-line c8 -- the refusal under test fires before the seed is read: the path names nothing on purpose
        expect(() => chain.seed(file('./seeds/rows.json') as never)).toThrow(
            /a file not ending in \.sql/u,
        );
    });
});
