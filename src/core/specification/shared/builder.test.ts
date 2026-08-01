import { describe, expect, test } from 'vitest';

import { type Contract, defineContracts } from '../../contracts/contract.js';
import { http } from '../../contracts/http.js';
import type { CliEnv, CliOutput, CliPort } from '../../ports/cli.port.js';
import type { DatabasePort } from '../../ports/database.port.js';
import type { ServiceHandle } from '../../ports/service.port.js';
import { createApiFacet, createCliFacet, SpecificationBuilder } from './builder.js';
import { StubBackend } from './stub-backend.js';

// ── Fakes — mocks are code (CONVENTIONS I4) ──

class FakeCommandAdapter implements CliPort {
    lastArgs: string | undefined;
    lastEnv: CliEnv | undefined;

    async exec(args: string, _cwd: string, env?: CliEnv): Promise<CliOutput> {
        this.lastArgs = args;
        this.lastEnv = env;
        return { exitCode: 0, stderr: '', stdout: '' };
    }

    async watch(): Promise<CliOutput> {
        return { exitCode: 0, stderr: '', stdout: '' };
    }
}

function fakeDatabase(): DatabasePort {
    return {
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
        composeName: null,
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
        started: true,
        type: options.type,
    };
}

describe('builder — exec argument validation', () => {
    test('exec([]) is rejected with a clear error', () => {
        // Given - a builder with no particular config
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - an empty command sequence is a usage error, synchronously
        expect(() => builder.exec([])).toThrow('exec([]) requires at least one command');
    });

    test('exec(array) with waitFor/timeout stays rejected', () => {
        // Given - a command sequence plus long-running options
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - the combination is rejected before the empty-array path
        expect(() => builder.exec(['a', 'b'], { waitFor: 'x' })).toThrow(
            'not supported with a command sequence',
        );
    });

    test('exec() with no arguments runs the binary bare', async () => {
        // Given - a cli runner with a command adapter that records its args
        const command = new FakeCommandAdapter();
        const cli = createCliFacet({ command, services: {} });

        // When - the spec invokes the binary with no arguments
        await cli.exec();

        // Then - the adapter received no CLI args (bare invocation), not an error
        expect(command.lastArgs).toBe('');
    });
});

describe('builder — service env injection (CONVENTIONS B6)', () => {
    test('injects <KEY>_URL per service plus unambiguous DATABASE_URL / REDIS_URL', async () => {
        // Given - a cli runner with one SQL database and one redis
        const command = new FakeCommandAdapter();
        const cli = createCliFacet({
            command,
            services: {
                cache: fakeService({
                    connectionString: 'redis://cache:6379/0',
                    isDatabase: false,
                    type: 'redis',
                }),
                db: fakeService({
                    connectionString: 'postgres://db:5432/app',
                    isDatabase: true,
                    type: 'postgres',
                }),
            },
        });

        // When - a spec executes
        await cli.exec('run');

        // Then - the child env carries the per-key URLs and both aliases
        expect(command.lastEnv).toMatchObject({
            CACHE_URL: 'redis://cache:6379/0',
            DATABASE_URL: 'postgres://db:5432/app',
            DB_URL: 'postgres://db:5432/app',
            REDIS_URL: 'redis://cache:6379/0',
        });
    });

    test('.env() overrides the injection and null unsets', async () => {
        // Given - a runner whose spec overrides one URL and unsets another
        const command = new FakeCommandAdapter();
        const cli = createCliFacet({
            command,
            services: {
                db: fakeService({
                    connectionString: 'postgres://db:5432/app',
                    isDatabase: true,
                    type: 'postgres',
                }),
            },
        });

        // When
        await cli.env({ DATABASE_URL: 'postgres://elsewhere/app', DB_URL: null }).exec('run');

        // Then - user env always wins; null reaches the adapter as an unset marker
        expect(command.lastEnv?.DATABASE_URL).toBe('postgres://elsewhere/app');
        expect(command.lastEnv?.DB_URL).toBeNull();
    });
});

/** The contracts a chain accumulated, tagged by their response body number. */
function declaredNumbers(builder: SpecificationBuilder): number[] {
    const internals = builder as unknown as {
        contracts: { response: { body: { n: number } } }[];
    };
    return internals.contracts.map((contract) => contract.response.body.n);
}

describe('builder — intercept input forms', () => {
    test('a list of contracts registers in declaration order', () => {
        // Given - two contracts on one route, distinguishable by response body
        const builder = new SpecificationBuilder({}, import.meta.dirname);
        const request = http.get('https://x.test/');
        const first: Contract = { request, response: http.json({ n: 1 }) };
        const second: Contract = { request, response: http.json({ n: 2 }) };

        // When - registered as a single array call
        builder.intercept([first, second]);

        // Then - both are queued, in array order (identical to two calls)
        expect(declaredNumbers(builder)).toEqual([1, 2]);
    });

    test('a composite is flattened, and .with() lands its override first', () => {
        // Given - a composite and a scenario derived from it
        const builder = new SpecificationBuilder({}, import.meta.dirname);
        const request = http.get('https://x.test/');
        const base = defineContracts(
            { request, response: http.json({ n: 1 }) },
            { request: http.get('https://y.test/'), response: http.json({ n: 2 }) },
        );

        // When - the chain declares the scenario
        builder.intercept(base.with({ request, response: http.json({ n: 9 }) }));

        // Then - the override replaced its route and leads the queue
        expect(declaredNumbers(builder)).toEqual([9, 2]);
    });

    test('a bare request half without its response is refused', () => {
        // Given - a chain handed only the request half
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - the error names both accepted forms
        expect(() => builder.intercept(http.get('https://x.test/') as never)).toThrow(
            '.intercept(): a bare request needs its response',
        );
    });
});

describe('builder — intercepts in compose mode (CONVENTIONS I3)', () => {
    test('.intercept() throws immediately when the runner disabled intercepts', () => {
        // Given - an api facet configured the way compose mode builds it
        const api = createApiFacet({
            interceptDisabledReason:
                'intercepts are in-process (MSW) and not available in compose mode — ' +
                'keep intercept specs in node-only vitest projects.',
        });

        // Then - the error is thrown at .intercept() call time, not at the action
        expect(() => api.intercept(http.get('https://x.test/'), http.json({}))).toThrow(
            '.intercept(): intercepts are in-process (MSW) and not available in compose mode — ' +
                'keep intercept specs in node-only vitest projects.',
        );
    });

    test('.intercept() stays available when the reason is unset (node mode)', () => {
        // Given - a plain builder (node-mode config)
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - registering an inline intercept chains normally
        expect(() => builder.intercept(http.get('https://x.test/'), http.json({}))).not.toThrow();
    });
});

// ── Stub-backend facets ──

describe('builder — contracts on the stub facets', () => {
    test('a website chain queues its contracts for the declared stub backend', () => {
        // Given - a website-shaped config carrying a stub backend
        const builder = new SpecificationBuilder(
            { backend: new StubBackend(), baseUrl: 'http://127.0.0.1:9' },
            import.meta.dirname,
        );

        // When - the chain declares two contracts
        builder.intercept([
            { request: http.get('/events'), response: http.json({ n: 1 }) },
            { request: http.get('/articles'), response: http.json({ n: 2 }) },
        ]);

        // Then - both are held for the stub, in declaration order
        expect(declaredNumbers(builder)).toEqual([1, 2]);
    });

    test('a website chain without a backend option names the fix', () => {
        // Given - a website-shaped config with no stub backend declared
        const builder = new SpecificationBuilder(
            { baseUrl: 'http://127.0.0.1:9' },
            import.meta.dirname,
        );

        // Then - the error points at the specification options
        expect(() =>
            builder.intercept({ request: http.get('/events'), response: http.empty() }),
        ).toThrow(
            '.intercept(): this runner has no declared backend — add `backend` to the specification options (specification.website({ …, backend: { … } }))',
        );
    });

    test('a mobile chain without a backend option names its own constructor', () => {
        // Given - a mobile-shaped config (a device accessor, no backend)
        const builder = new SpecificationBuilder(
            { device: () => Promise.reject(new Error('unused')) },
            import.meta.dirname,
        );

        // Then - the fix names specification.mobile
        expect(() =>
            builder.intercept({ request: http.get('/events'), response: http.empty() }),
        ).toThrow('specification.mobile({ …, backend');
    });
});

// ── Adapter requirements ──

describe('builder — adapter requirements', () => {
    test('throws without command adapter', async () => {
        // Given - a cli facet built with no command adapter
        const badCli = createCliFacet({});

        // Then - a clear error explains what is missing
        await expect(badCli.exec('build')).rejects.toThrow(
            'Command actions require a command adapter',
        );
    });
});

// ── SQL seed targeting ──

describe('builder — sql seed targeting', () => {
    test('seed() with an unknown database key lists the available keys', async () => {
        // Given - two named databases in the config
        const cli = createCliFacet({
            command: new FakeCommandAdapter(),
            databaseKeys: ['analytics', 'db'],
            databases: new Map<string, DatabasePort>([
                ['analytics', fakeDatabase()],
                ['db', fakeDatabase()],
            ]),
        });

        // Then - the error names the missing key and enumerates the record
        await expect(cli.seed('x.sql', { database: 'ghost' }).exec('run')).rejects.toThrow(
            'seed() targets database "ghost" but it was not found. Available: analytics, db',
        );
    });

    test('requires the database option when two or more databases are declared (A7)', () => {
        // Given - two databases declared
        const cli = createCliFacet({
            command: new FakeCommandAdapter(),
            databaseKeys: ['analytics', 'db'],
        });

        // Then - a bare SQL seed is rejected until it names its target database
        expect(() => cli.seed('users.sql')).toThrow('2 databases are declared');
    });
});

// ── Automatic service env injection (CONVENTIONS B6) ──

describe('builder — service env injection', () => {
    test('injects <KEY>_URL per service and omits DATABASE_URL with two SQL databases', async () => {
        // Given - two SQL databases in the services record
        const command = new FakeCommandAdapter();
        const cli = createCliFacet({
            command,
            services: {
                analytics: fakeService({
                    connectionString: 'postgresql://analytics',
                    isDatabase: true,
                    type: 'postgres',
                }),
                db: fakeService({
                    connectionString: 'postgresql://db',
                    isDatabase: true,
                    type: 'postgres',
                }),
            },
        });

        await cli.exec('run');

        // Then - per-key URLs injected; the ambiguous alias is not
        expect(command.lastEnv?.ANALYTICS_URL).toBe('postgresql://analytics');
        expect(command.lastEnv?.DB_URL).toBe('postgresql://db');
        expect(command.lastEnv).not.toHaveProperty('DATABASE_URL');
    });

    test('omits REDIS_URL when two redis services are declared', async () => {
        // Given - two redis handles in the services record
        const command = new FakeCommandAdapter();
        const cli = createCliFacet({
            command,
            services: {
                cache: fakeService({
                    connectionString: 'redis://cache',
                    isDatabase: false,
                    type: 'redis',
                }),
                queue: fakeService({
                    connectionString: 'redis://queue',
                    isDatabase: false,
                    type: 'redis',
                }),
            },
        });

        await cli.exec('run');

        // Then - per-key URLs only; the ambiguous alias is absent
        expect(command.lastEnv?.CACHE_URL).toBe('redis://cache');
        expect(command.lastEnv?.QUEUE_URL).toBe('redis://queue');
        expect(command.lastEnv).not.toHaveProperty('REDIS_URL');
    });

    test('sanitizes non-alphanumeric key characters in the env var name', async () => {
        // Given - a service key containing a dash
        const command = new FakeCommandAdapter();
        const cli = createCliFacet({
            command,
            services: {
                'db-main': fakeService({
                    connectionString: 'file:main.sqlite',
                    isDatabase: true,
                    type: 'sqlite',
                }),
            },
        });

        await cli.exec('run');

        // Then - the dash becomes an underscore, and the single SQL database
        // Also gets the unambiguous DATABASE_URL alias
        expect(command.lastEnv?.DB_MAIN_URL).toBe('file:main.sqlite');
        expect(command.lastEnv?.DATABASE_URL).toBe('file:main.sqlite');
    });
});
