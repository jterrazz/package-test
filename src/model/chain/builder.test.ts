import { existsSync } from 'node:fs';
import { describe, expect, onTestFinished, test } from 'vitest';

import { defineContracts } from '../../stubs/contract.js';
import type { Contract } from '../../stubs/contract.js';
import { http } from '../../stubs/http/http.js';
import type { CliEnv, CliOutput, CliPort } from '../ports/cli.port.js';
import type { DatabasePort } from '../ports/database.port.js';
import type { ServiceHandle } from '../ports/service.port.js';
import { createCliFacet, SpecificationBuilder } from './builder.js';
import { directory, file } from './spec-path.js';

// ── Fakes — mocks are code (CONVENTIONS I4) ──

class FakeCommandAdapter implements CliPort {
    lastArgs: string | undefined;
    lastCwd: string | undefined;
    lastEnv: CliEnv | undefined;

    async exec(args: string, cwd: string, env?: CliEnv): Promise<CliOutput> {
        this.lastArgs = args;
        this.lastCwd = cwd;
        this.lastEnv = env;
        return { exitCode: 0, stderr: '', stdout: '' };
    }

    async watch(): Promise<CliOutput> {
        return { exitCode: 0, stderr: '', stdout: '' };
    }
}

function fakeDatabase(): DatabasePort {
    return {
        columns: async () => await Promise.resolve([]),
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
        serviceName: null,
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
    test('exec([]) is rejected with a clear error', async () => {
        // Given - a builder with no particular config
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - an empty command sequence is a usage error: `.exec()` answers a promise, so the refusal arrives as a rejection, not a synchronous throw
        await expect(builder.exec([])).rejects.toThrow('exec([]) requires at least one command');
    });

    test('exec(array) with waitFor/timeout stays rejected', async () => {
        // Given - a command sequence plus long-running options
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - the combination is rejected before the empty-array path
        await expect(builder.exec(['a', 'b'], { waitFor: 'x' })).rejects.toThrow(
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
        expect(declaredNumbers(builder)).toStrictEqual([1, 2]);
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
        expect(declaredNumbers(builder)).toStrictEqual([9, 2]);
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

describe('builder — the request a chain declares', () => {
    test('.intercept() takes an inline pair and chains', () => {
        // Given - a plain builder
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - registering an inline intercept chains normally
        expect(() => builder.intercept(http.get('https://x.test/'), http.json({}))).not.toThrow();
    });
});

// ── Stub-backend facets ──

describe('builder — contracts on the stub facets', () => {
    test('a mobile chain without a backend option names its own constructor', () => {
        // Given - a mobile-shaped config (a device accessor, no backend)
        const builder = new SpecificationBuilder(
            {
                device: async () => {
                    throw new Error('unused');
                },
            },
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
        await expect(
            // checker-disable-next-line c8 -- the refusal under test fires before the seed is read: the path names nothing on purpose
            cli.seed(file('./seeds/x.sql'), { database: 'ghost' }).exec('run'),
        ).rejects.toThrow(
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
        // checker-disable-next-line c8 -- the refusal under test fires before the seed is read: the path names nothing on purpose
        expect(() => cli.seed(file('./seeds/users.sql'))).toThrow('2 databases are declared');
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

        // Then - the dash becomes an underscore, and the single SQL database also gets the unambiguous DATABASE_URL alias
        expect(command.lastEnv?.DB_MAIN_URL).toBe('file:main.sqlite');
        expect(command.lastEnv?.DATABASE_URL).toBe('file:main.sqlite');
    });
});

describe('builder — what a file shares, with()', () => {
    test('every chain of the view starts from the context, and its own setups merge over it', async () => {
        // Given - a cli facet with a file's environment, and one chain adding to it
        const command = new FakeCommandAdapter();
        const cli = createCliFacet({ command }).with({ env: { LANG: 'fr', TZ: 'UTC' } });

        // When - a chain overrides one variable of the context
        await cli.env({ TZ: 'Europe/Paris' }).exec('run');
        const overridden = command.lastEnv;
        await cli.exec('run');

        // Then - the chain's own setting wins, and the next chain starts from the context again
        expect(overridden).toMatchObject({ LANG: 'fr', TZ: 'Europe/Paris' });
        expect(command.lastEnv).toMatchObject({ LANG: 'fr', TZ: 'UTC' });
    });

    test('a context states only what it names: no clock, no environment, nothing set', () => {
        // Given - a chain handed an empty context
        const builder = new SpecificationBuilder({}, '/tmp').with({});

        // Then - it pins nothing and carries no variable
        const internals = builder as unknown as {
            commandEnv: object;
            pinnedClock: null | string;
        };
        expect({ clock: internals.pinnedClock, env: internals.commandEnv }).toStrictEqual({
            clock: null,
            env: {},
        });
    });
});

describe('builder — the calendar a chain pins', () => {
    test('.clock() takes the instant and travels with the chain', () => {
        // Given - a plain builder
        const builder = new SpecificationBuilder({}, import.meta.dirname);

        // Then - the instant is accepted
        expect(() => builder.clock('2026-03-04T09:30:00Z')).not.toThrow();
    });
});

describe('builder — a string is a value, and the disk is file() or directory()', () => {
    test('refuses a bare string where a verb reads the disk, naming the wrapper', () => {
        // Given - a cli facet over a fake binary, called by a caller the compiler does not see
        const cli = createCliFacet({ command: new FakeCommandAdapter() });

        // Then - each verb that reads the disk refuses the string and names file()
        expect(() => cli.seed('./seeds/rows.sql' as never)).toThrow(
            /^found: seed\("\.\/seeds\/rows\.sql"\), a value where a file is read\n.*\nfix: name one file: seed\(file\(/u,
        );
        expect(() => cli.seed("INSERT INTO users (name) VALUES ('Ada');" as never)).toThrow(
            /^found: seed\("INSERT INTO users \(name\) VALUES \('Ada'\);"\), a value where a file is read\n.*\nfix: name one file: seed\(file\('\.\/seeds\/rows\.sql'\)\)\n/u,
        );
        expect(() => cli.fixture('./fixtures/shop/' as never)).toThrow(
            /^found: fixture\("\.\/fixtures\/shop\/"\), a value where the disk is read\n.*\nfix: name the disk: fixture\(file/u,
        );
        // checker-disable-next-line c8 -- the refusal under test fires before the seed is read: the path names nothing on purpose
        expect(() => cli.seed(directory('./seeds/') as never)).toThrow(
            /a directory where one file is read/u,
        );
        // checker-disable-next-line c8 -- the refusal under test fires before the seed is read: the path names nothing on purpose
        expect(() => cli.seed(file('./seeds/rows.json') as never)).toThrow(
            /a file not ending in \.sql/u,
        );
    });

    test('a directory spreads and a file copies, and each refuses the other on disk', async () => {
        // Given - a directory and a file this test stands on
        const cli = createCliFacet({ command: new FakeCommandAdapter() });
        const run = cli
            .fixture(directory('./fixtures/shop/'))
            .fixture(file('./fixtures/config.json'))
            .exec('go');

        // Then - both copy; each named as the other is refused with the kind on disk
        await expect(run).resolves.toBeDefined();
        // checker-disable-next-line c8 -- the kind on disk is the refusal under test: each path names the other kind on purpose
        await expect(cli.fixture(directory('./fixtures/config.json/')).exec('go')).rejects.toThrow(
            /names a file\n.*\nfix: drop the \//u,
        );
        // checker-disable-next-line c8 -- the kind on disk is the refusal under test: each path names the other kind on purpose
        await expect(cli.fixture(file('./fixtures/shop')).exec('go')).rejects.toThrow(
            /names a directory\n.*\nfix: end its path in \//u,
        );
    });
});

describe('builder — the folder a command runs in', () => {
    test('exists while the test runs, and is removed once it has finished', async () => {
        // Given - a check that runs after the test's own teardowns, and a cli facet over a fake binary
        const command = new FakeCommandAdapter();
        onTestFinished(() => {
            expect(existsSync(command.lastCwd ?? '')).toBe(false);
        });

        // When - a command runs
        await createCliFacet({ command }).exec('go');

        // Then - it ran in a folder that is there for the rest of the test
        expect(existsSync(command.lastCwd ?? '')).toBe(true);
    });
});
