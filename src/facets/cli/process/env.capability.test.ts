import { describe, expect, test } from 'vitest';

import { defineAction } from '../../../chain/action.js';
import { sharing } from '../../../chain/context/with.capability.js';
import { defineFacet } from '../../../chain/define-facet.js';
import type { DatabasePort } from '../../../services/database.port.js';
import type { ServiceHandle } from '../../../services/service.port.js';
import type { CliEnv } from './cli.port.js';
import { childEnv, env } from './env.capability.js';
import type { EnvMethod } from './env.capability.js';

const WORKDIR = import.meta.dirname;

function fakeDatabase(): DatabasePort {
    return {
        columns: async () => [],
        query: async () => [],
        reset: async () => {},
        seed: async () => {},
    };
}

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
        healthcheck: async () => {},
        initialize: async () => {},
        isolation: () => ({
            acquire: async () => {},
            release: async () => {},
            reset: async () => {},
        }),
        reset: async () => {},
        serviceName: null,
        type: options.type,
    };
}

const postgres = (connectionString: string): ServiceHandle =>
    fakeService({ connectionString, isDatabase: true, type: 'postgres' });
const redis = (connectionString: string): ServiceHandle =>
    fakeService({ connectionString, isDatabase: false, type: 'redis' });

type Chain = {
    env: EnvMethod<Chain>;
    handed: () => Promise<CliEnv | undefined>;
    with: (context: { env?: CliEnv }) => Chain;
};
const handed = defineAction({
    accessors: [],
    name: 'handed',
    perform: async (_args: [], read, _adapters, { config }) => childEnv(config, read(env), WORKDIR),
    row: { group: 'Terminal action', name: '.handed()', probe: '.handed(' },
});
describe('env', () => {
    test('env.capability — childEnv — what a child of the chain starts with (rule `service-urls-injected`) — injects <KEY>_URL per service plus unambiguous DATABASE_URL / REDIS_URL', () => {
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

    test('env.capability — childEnv — what a child of the chain starts with (rule `service-urls-injected`) — .env() overrides the injection and null unsets', () => {
        // Given - a chain overriding one injected URL and unsetting another
        const services = { db: postgres('postgres://db:5432/app') };
        const chained: CliEnv = { DATABASE_URL: 'postgres://elsewhere/app', DB_URL: null };

        // Then - the chain's env always wins; null reaches the child as an unset marker
        expect(childEnv({ services }, chained, WORKDIR)).toStrictEqual({
            DATABASE_URL: 'postgres://elsewhere/app',
            DB_URL: null,
        });
    });

    test('env.capability — childEnv — what a child of the chain starts with (rule `service-urls-injected`) — omits DATABASE_URL with two SQL databases', () => {
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

    test('env.capability — childEnv — what a child of the chain starts with (rule `service-urls-injected`) — omits REDIS_URL with two redis services', () => {
        // Given - two redis services declared
        const services = { cache: redis('redis://cache'), queue: redis('redis://queue') };

        // Then - per-key URLs only; the ambiguous alias is absent
        expect(childEnv({ services }, {}, WORKDIR)).toStrictEqual({
            CACHE_URL: 'redis://cache',
            QUEUE_URL: 'redis://queue',
        });
    });

    test('env.capability — childEnv — what a child of the chain starts with (rule `service-urls-injected`) — spells a key in constant case, a dash as an underscore', () => {
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

    test('env.capability — childEnv — what a child of the chain starts with — the defaults, then the services, then the docker run id, then the chain, $WORKDIR expanded and null kept', () => {
        // Given - defaults and a chain each naming the working directory and unsetting a variable, a database, and a docker run
        const docker = { envVar: 'TEST_RUN_ID', nameLabel: 'name', testRunLabel: 'run' };
        const config = {
            defaultEnv: { DATABASE_URL: 'sqlite://default', GONE: null, HOME: '$WORKDIR/home' },
            dockerConfig: docker,
            dockerTestRunId: 'run-1',
            services: { db: postgres('postgres://db:5432/app') },
        };

        // Then - each layer over the one before
        expect(
            childEnv(config, { OUT: '$WORKDIR/out/$WORKDIR', TEST_RUN_ID: 'mine' }, WORKDIR),
        ).toStrictEqual({
            DATABASE_URL: 'postgres://db:5432/app',
            DB_URL: 'postgres://db:5432/app',
            GONE: null,
            HOME: `${WORKDIR}/home`,
            OUT: `${WORKDIR}/out/${WORKDIR}`,
            TEST_RUN_ID: 'mine',
        });
    });

    test('env.capability — childEnv — what a child of the chain starts with — nothing set is no environment, and a docker run id counts only when there is one under a docker config', () => {
        // Given - configs with nothing to set, and docker halves alone
        const docker = { envVar: 'TEST_RUN_ID', nameLabel: 'name', testRunLabel: 'run' };

        // Then - none hands an environment
        expect([
            childEnv({}, {}, WORKDIR),
            childEnv({ services: {} }, {}, WORKDIR),
            childEnv({ dockerConfig: docker, dockerTestRunId: '' }, {}, WORKDIR),
            childEnv({ dockerConfig: docker }, {}, WORKDIR),
            childEnv({ dockerTestRunId: 'run-1' }, {}, WORKDIR),
            childEnv({ dockerConfig: docker, dockerTestRunId: 'run-1' }, {}, WORKDIR),
        ]).toStrictEqual([
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { TEST_RUN_ID: 'run-1' },
        ]);
    });

    test('env.capability — .env() — the environment a chain states — every chain of a with() view starts from the context, and its own .env() merges over it', async () => {
        // Given - a file's environment, and one chain adding to it
        const chain = defineFacet<Chain>()({
            actions: [handed],
            capabilities: [env, sharing],
            adapters: () => ({}),
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
