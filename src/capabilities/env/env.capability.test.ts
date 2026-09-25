import { describe, expect, test } from 'vitest';

import { defineFacet } from '../../facets/define-facet.js';
import { defineAction } from '../../model/chain/action.js';
import type { CliEnv } from '../../model/ports/cli.port.js';
import type { DatabasePort } from '../../model/ports/database.port.js';
import type { ServiceHandle } from '../../model/ports/service.port.js';
import { sharing } from '../with/with.capability.js';
import { childEnv, env } from './env.capability.js';
import type { EnvMethod } from './env.capability.js';

/** Where the child runs: a directory that exists, so `$WORKDIR` resolves. */
const WORKDIR = import.meta.dirname;

function fakeDatabase(): DatabasePort {
    return {
        columns: async () => await Promise.resolve([]),
        query: async () => await Promise.resolve([]),
        reset: async () => {
            await Promise.resolve();
        },
        seed: async () => {
            await Promise.resolve();
        },
    };
}

/** A started service of `type`, a SQL database when `isDatabase`. */
function fakeService(options: {
    connectionString: string;
    isDatabase: boolean;
    type: string;
}): ServiceHandle {
    return {
        buildConnectionString: () => options.connectionString,
        connectionString: options.connectionString,
        createDatabaseAdapter: () => (options.isDatabase ? fakeDatabase() : null),
        defaultImage: '',
        defaultPort: 0,
        environment: {},
        healthcheck: async () => {
            await Promise.resolve();
        },
        initialize: async () => {
            await Promise.resolve();
        },
        isolation: () => ({
            acquire: async () => {
                await Promise.resolve();
            },
            release: async () => {
                await Promise.resolve();
            },
            reset: async () => {
                await Promise.resolve();
            },
        }),
        reset: async () => {
            await Promise.resolve();
        },
        serviceName: null,
        started: true,
        type: options.type,
    };
}

const postgres = (connectionString: string): ServiceHandle =>
    fakeService({ connectionString, isDatabase: true, type: 'postgres' });
const redis = (connectionString: string): ServiceHandle =>
    fakeService({ connectionString, isDatabase: false, type: 'redis' });

describe('childEnv — what a child of the chain starts with (CONVENTIONS B6)', () => {
    test('injects <KEY>_URL per service plus unambiguous DATABASE_URL / REDIS_URL', () => {
        // Given - one SQL database and one redis declared
        const services = {
            cache: redis('redis://cache:6379/0'),
            db: postgres('postgres://db:5432/app'),
        };

        // Then - the per-key URLs and both aliases
        expect(childEnv({ services }, {}, WORKDIR)).toStrictEqual({
            CACHE_URL: 'redis://cache:6379/0',
            DATABASE_URL: 'postgres://db:5432/app',
            DB_URL: 'postgres://db:5432/app',
            REDIS_URL: 'redis://cache:6379/0',
        });
    });

    test('.env() overrides the injection and null unsets', () => {
        // Given - a chain overriding one injected URL and unsetting another
        const services = { db: postgres('postgres://db:5432/app') };
        const chained: CliEnv = { DATABASE_URL: 'postgres://elsewhere/app', DB_URL: null };

        // Then - the chain's env always wins; null reaches the child as an unset marker
        expect(childEnv({ services }, chained, WORKDIR)).toStrictEqual({
            DATABASE_URL: 'postgres://elsewhere/app',
            DB_URL: null,
        });
    });

    test('omits DATABASE_URL with two SQL databases', () => {
        // Given - two SQL databases declared
        const services = {
            analytics: postgres('postgresql://analytics'),
            db: postgres('postgresql://db'),
        };

        // Then - per-key URLs only; the ambiguous alias is absent
        expect(childEnv({ services }, {}, WORKDIR)).toStrictEqual({
            ANALYTICS_URL: 'postgresql://analytics',
            DB_URL: 'postgresql://db',
        });
    });

    test('omits REDIS_URL with two redis services', () => {
        // Given - two redis services declared
        const services = { cache: redis('redis://cache'), queue: redis('redis://queue') };

        // Then - per-key URLs only; the ambiguous alias is absent
        expect(childEnv({ services }, {}, WORKDIR)).toStrictEqual({
            CACHE_URL: 'redis://cache',
            QUEUE_URL: 'redis://queue',
        });
    });

    test('spells a key in constant case, a dash as an underscore', () => {
        // Given - a service key containing a dash
        const services = {
            'db-main': fakeService({
                connectionString: 'file:main.sqlite',
                isDatabase: true,
                type: 'sqlite',
            }),
        };

        // Then - the dash becomes an underscore, and the single SQL database also gets the alias
        expect(childEnv({ services }, {}, WORKDIR)).toStrictEqual({
            DATABASE_URL: 'file:main.sqlite',
            DB_MAIN_URL: 'file:main.sqlite',
        });
    });
});

/** A chain composed of `.env()` and `with()`, ending on what a child would be handed. */
type Chain = {
    env: EnvMethod<Chain>;
    handed: () => Promise<CliEnv | undefined>;
    with: (context: { env?: CliEnv }) => Chain;
};

const handed = defineAction({
    accessors: [],
    name: 'handed',
    perform: async (_args: [], read, _engines, { config }) =>
        await Promise.resolve(childEnv(config, read(env), WORKDIR)),
    row: { group: 'Terminal action', name: '.handed()', probe: '.handed(' },
});

describe('.env() — the environment a chain states', () => {
    test('every chain of a with() view starts from the context, and its own .env() merges over it', async () => {
        // Given - a file's environment, and one chain adding to it
        const chain = defineFacet<Chain>()({
            actions: [handed],
            capabilities: [env, sharing],
            engines: () => ({}),
            locate: () => WORKDIR,
            options: {},
        })
            .open({})
            .with({ env: { LANG: 'fr', TZ: 'UTC' } });

        // When - a chain overrides one variable of the context, then the next one states none
        const overridden = await chain.env({ TZ: 'Europe/Paris' }).handed();
        const next = await chain.handed();

        // Then - the chain's own setting wins, and the next chain starts from the context again
        expect({ next, overridden }).toStrictEqual({
            next: { LANG: 'fr', TZ: 'UTC' },
            overridden: { LANG: 'fr', TZ: 'Europe/Paris' },
        });
    });
});
