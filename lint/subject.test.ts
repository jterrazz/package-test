import { describe, expect, test } from 'vitest';

import {
    ambiguousSegment,
    commandWords,
    declaredCommands,
    doorsOf,
    pathTemplate,
    subjectFolder,
    subjectName,
    subjectsOf,
} from './subject.js';
import type { Subject } from './subject.js';

/** A template's hole, as the reader keeps it in a literal. */
const HOLE = '\u0000';
describe('subject', () => {
    test.each<[string, Subject, string | undefined]>([
        [
            'GET /events — a collection is listed',
            { facet: 'api', method: 'GET', path: '/events' },
            'events/list',
        ],
        [
            'GET /events/:id — an item is got',
            { facet: 'api', method: 'GET', path: '/events/:id' },
            'events/get',
        ],
        [
            'POST /events — created',
            { facet: 'api', method: 'POST', path: '/events' },
            'events/create',
        ],
        [
            'PUT /events/:id — updated',
            { facet: 'api', method: 'PUT', path: '/events/:id' },
            'events/update',
        ],
        [
            'PATCH /events/:id — updated',
            { facet: 'api', method: 'PATCH', path: '/events/:id' },
            'events/update',
        ],
        [
            'DELETE /events/:id — deleted',
            { facet: 'api', method: 'DELETE', path: '/events/:id' },
            'events/delete',
        ],
        [
            'GET /events/:id/timeline — its literal segments',
            { facet: 'api', method: 'GET', path: '/events/:id/timeline' },
            'events/timeline',
        ],
        [
            'GET /health — a singleton is got',
            { facet: 'api', method: 'GET', path: '/health' },
            'health/get',
        ],
        [
            'GET /market/:symbol/chart — its literal segments',
            { facet: 'api', method: 'GET', path: '/market/:symbol/chart' },
            'market/chart',
        ],
        [
            'ALL /mcp — a method-less route is its segments',
            { facet: 'api', method: 'ALL', path: '/mcp' },
            'mcp',
        ],
        [
            'GET /status — a word ending in s is no collection',
            { facet: 'api', method: 'GET', path: '/status' },
            'status/get',
        ],
        [
            'GET /events/42 — a concrete path is read as its template',
            { facet: 'api', method: 'GET', path: '/events/42?lang=fr' },
            'events/get',
        ],
        [
            'GET / — the root names no resource',
            { facet: 'api', method: 'GET', path: '/' },
            undefined,
        ],
        ['a job is its name', { facet: 'job', job: 'digest' }, 'digest'],
        ['a cli command is its words', { command: ['db', 'migrate'], facet: 'cli' }, 'db/migrate'],
        ['a cli run with no command word has no name', { command: [], facet: 'cli' }, undefined],
        ['a page has no standard name', { facet: 'website', page: '/pricing' }, undefined],
        [
            'a journey has no standard name',
            { facet: 'mobile', journey: 'news://events' },
            undefined,
        ],
    ])('subjectFolder — the standard name, derived from the subject — %s', (_, subject, folder) => {
        // Given - a subject a spec reaches
        // Then - the folder it is filed under, relative to its facet folder
        expect(subjectFolder(subject)).toBe(folder);
    });

    test.each([
        ['/users/1', '/users/:id'],
        [`/users/${HOLE}/posts`, '/users/:id/posts'],
        ['/market/AAPL/chart', '/market/:id/chart'],
        ['/search?q=x', '/search'],
        ['/', '/'],
    ])(
        'the subject a spec reaches, read statically — the path %s is the route %s',
        (path, template) => {
            // Given - a path as a spec writes it
            // Then - the template a route declares
            expect(pathTemplate(path)).toBe(template);
        },
    );

    test('the subject a spec reaches, read statically — reads the terminal action of every chain off an imported handle, and nothing else', () => {
        // Given - a spec with two chains, a stub builder's own `.get`, and a chain in a comment
        const source = [
            "import { api } from '../api.specification.js';",
            "const events = api.with({ clock: '2026-01-01T00:00:00Z' });",
            "test('a', async () => { await api.seed(file('./seeds/x.sql')).get('/events/42'); });",
            `test('b', async () => { await events.intercept(http.get('https://x.test/')).post(\`/events/\${id}/publish\`, {}); });`,
            "// await api.delete('/events/1');",
        ].join('\n');

        // Then - one subject per chain, the view included, the builder and the comment left out
        expect(subjectsOf(source).map(({ subject }) => subjectName(subject))).toStrictEqual([
            'GET /events/:id',
            'POST /events/:id/publish',
        ]);
    });

    test('the subject a spec reaches, read statically — reads a route template as the route, the params beside it telling a literal path that it is one', () => {
        // Given - the same chart route as a template, a filled path, and a literal path stated as its route
        const source = [
            "import { api } from '../api.specification.js';",
            "await api.get('/indicators/:symbol/chart?range=1D', { params: { symbol: 'btc' } });",
            "await api.get('/indicators/btc/chart');",
            "await api.post('/indicators/latest/refresh', {}, { params: {} });",
        ].join('\n');
        const subjects = subjectsOf(source).map(({ subject }) => subject);

        // Then - the template files under the route's literals; the filled path reads two ways; the stated one is literal
        expect(subjects.map((subject) => subjectFolder(subject))).toStrictEqual([
            'indicators/chart',
            undefined,
            'indicators/latest/refresh',
        ]);
        expect(subjects.map((subject) => ambiguousSegment(subject))).toStrictEqual([
            undefined,
            'btc',
            undefined,
        ]);
    });

    test.each([
        ['/indicators/btc/chart', 'btc'],
        ['/users/me/settings', 'me'],
        ['/map/pois/detail', undefined],
        ['/market/btc/chart', undefined],
        ['/events/42/timeline', undefined],
        ['/data/series/points', 'series'],
    ])(
        'the subject a spec reaches, read statically — a word after a collection, with more path after it, reads two ways: %s → %s',
        (path, segment) => {
            // Given - a literal path sent with no template, `data` a declared collection
            const subject = { facet: 'api' as const, method: 'GET' as const, path };

            // Then - the word that may be a value, if any
            expect(ambiguousSegment(subject, { collections: ['data'] })).toBe(segment);
        },
    );

    test('the subject a spec reaches, read statically — reads the request line of a .http the chain sends', () => {
        // Given - a request named by file(), and the disk that holds it
        const source = [
            "import { api } from '../api.specification.js';",
            "await api.request(file('./requests/create.http'));",
        ].join('\n');

        // Then - its method and path are the subject
        expect(
            subjectsOf(source, (path) =>
                path === './requests/create.http' ? 'POST /events\n\n{}' : undefined,
            ).map(({ subject }) => subjectName(subject)),
        ).toStrictEqual(['POST /events']);
    });

    test('the subject a spec reaches, read statically — reads a job, the words of a command, a page and a journey', () => {
        // Given - one chain of each other facet
        const source = [
            "import { cli, job, mobile, website } from '../x.specification.js';",
            "await job.trigger('digest');",
            "await cli.exec('db migrate --dry-run');",
            "await cli.exec(['build', 'serve ./dist']);",
            "await website.visit('/articles/42', async () => {});",
            "await mobile.open('news://events');",
        ].join('\n');

        // Then - each chain's subject, a command its first word, a cli sequence the command it opens on
        expect(subjectsOf(source).map(({ subject }) => subjectName(subject))).toStrictEqual([
            'trigger digest',
            'exec db',
            'exec build',
            'visit /articles/:id',
            'open news://events',
        ]);
    });

    test.each([
        ['db migrate --dry-run', ['db']],
        ['spawn shop', ['spawn']],
        ['--help', []],
        ['.', []],
        ['check ./src', ['check']],
    ])(
        'the subject a spec reaches, read statically — with no declared list, the command line %j names the command %j',
        (line, words) => {
            // Given - a command line a chain runs, its runner declaring no command list
            // Then - the first word alone names the command: a positional argument is no subcommand
            expect(commandWords(line)).toStrictEqual(words);
        },
    );

    test.each([
        ['db migrate --dry-run', ['db', 'migrate']],
        ['spawn shop', ['spawn']],
        ['migrate db', ['migrate', 'db']],
        ['shop', []],
        ['--help', []],
    ])(
        'the subject a spec reaches, read statically — with the list db, migrate, spawn, the command line %j names %j',
        (line, words) => {
            // Given - a runner declaring the words its commands are spelled with
            const commands = ['db', 'migrate', 'spawn'];

            // Then - the leading words the list holds name the command, the first other word ends it
            expect(commandWords(line, commands)).toStrictEqual(words);
        },
    );

    test("the subject a spec reaches, read statically — a spec's cli chain reads its runner's list, handed in", () => {
        // Given - a chain running a two-word command, and the list its runner declares
        const source = [
            "import { cli } from '../cli.specification.js';",
            "await cli.exec('db migrate --dry-run');",
        ].join('\n');

        // Then - both words name the command, and the folder
        const [at] = subjectsOf(source, undefined, { commands: { cli: ['db', 'migrate'] } });
        expect(at === undefined ? undefined : subjectFolder(at.subject)).toBe('db/migrate');
    });

    test('the subject a spec reaches, read statically — each chain reads the list of the runner its handle came from', () => {
        // Given - two runners in one spec, only the second declaring a list, and a view of it
        const source = [
            "import { cli } from '../cli.specification.js';",
            "import { cli as dbCli } from '../db-cli.specification.js';",
            'const db = dbCli.with({});',
            "await cli.exec('db migrate');",
            "await dbCli.exec('db migrate');",
            "await db.exec('db migrate');",
        ].join('\n');

        // When - each chain is read
        const folders = subjectsOf(source, undefined, {
            commands: { db: ['db', 'migrate'], dbCli: ['db', 'migrate'] },
        }).map(({ subject }) => subjectFolder(subject));

        // Then - the first word for the plain runner, the declared words for the other and its view
        expect(folders).toStrictEqual(['db', 'db/migrate', 'db/migrate']);
    });

    test('what a repository declares — its runner commands, its irregular collections — the list a specification module declares is read from its cli constructor', () => {
        // Given - a door declaring its commands among other options, and one declaring none
        const declaring = [
            "import { specification } from '@jterrazz/test';",
            "// commands: ['ignored'] in a comment",
            "export const { cleanup, cli } = await specification.cli(BIN, { defaults: { TZ: 'UTC' }, commands: ['db', \"migrate\"] });",
        ].join('\n');
        const silent =
            'export const { cleanup, cli } = await specification.cli(BIN, { commands });';

        // Then - the literal words, and nothing where the list is bound to nothing or absent
        expect(declaredCommands(declaring)).toStrictEqual(['db', 'migrate']);
        expect(declaredCommands(silent)).toBeUndefined();
        expect(
            declaredCommands('export const { cli } = await specification.cli(BIN);'),
        ).toBeUndefined();
    });

    test.each([
        ['commands: COMMANDS', "const COMMANDS = ['db', 'migrate'] as const;"],
        ['commands', "const commands: readonly string[] = ['db', 'migrate'];"],
    ])(
        'what a repository declares — its runner commands, its irregular collections — a list bound to a const of the runner file is followed (%s)',
        (option, binding) => {
            // Given - the runner naming its list by a const of its own file
            const door = [
                binding,
                `export const { cleanup, cli } = await specification.cli(BIN, { ${option} });`,
            ].join('\n');

            // Then - the words the const binds
            expect(declaredCommands(door)).toStrictEqual(['db', 'migrate']);
        },
    );

    test('what a repository declares — its runner commands, its irregular collections — the door of a handle is the specification module it is imported from', () => {
        // Given - a spec importing an api and two clis, one under another name and viewed
        const source = [
            "import { api } from '../api.specification.js';",
            "import { cli } from '../cli.specification.js';",
            "import { cli as run } from '../db-cli.specification.js';",
            'const db = run.with({});',
        ].join('\n');

        // Then - each handle's door, a view under its runner's, for the facet asked about
        expect(doorsOf(source, 'cli')).toStrictEqual({
            cli: '../cli.specification.js',
            db: '../db-cli.specification.js',
            run: '../db-cli.specification.js',
        });
        expect(doorsOf(source, 'api')).toStrictEqual({ api: '../api.specification.js' });
        expect(doorsOf(source, 'job')).toStrictEqual({});
    });

    test.each<[string, readonly string[], string | undefined]>([
        ['/data', [], 'data/get'],
        ['/data', ['data'], 'data/list'],
        ['/people', ['people'], 'people/list'],
        ['/data/:id', ['data'], 'data/get'],
        ['/events', ['data'], 'events/list'],
    ])(
        'what a repository declares — its runner commands, its irregular collections — a GET on %s with the collections %j is filed under %s',
        (path, collections, folder) => {
            // Given - a GET on one resource, and the collections the repository declares
            const subject: Subject = { facet: 'api', method: 'GET', path };

            // Then - a declared collection is listed, the plural test holding for the rest
            expect(subjectFolder(subject, { collections })).toBe(folder);
        },
    );

    test('what a repository declares — its runner commands, its irregular collections — a route the repository names method-less is reached by any verb, and filed by its segments', () => {
        // Given - a POST and a PUT to /mcp, and a GET to /events, with /mcp declared method-less
        const source = [
            "import { api } from '../api.specification.js';",
            "await api.post('/mcp', {});",
            "await api.put('/mcp', {});",
            "await api.get('/events');",
        ].join('\n');
        const reached = subjectsOf(source, undefined, { methodless: ['/mcp'] }).map(
            ({ subject }) => [subjectName(subject), subjectFolder(subject)],
        );

        // Then - both verbs reach ALL /mcp, under mcp/, and the undeclared route keeps its verb
        expect(reached).toStrictEqual([
            ['ALL /mcp', 'mcp'],
            ['ALL /mcp', 'mcp'],
            ['GET /events', 'events/list'],
        ]);
    });
});
