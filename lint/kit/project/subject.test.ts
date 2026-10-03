import { describe, expect, test } from 'vitest';

import { FOLDERS } from './subject.fixtures.js';
import {
    ambiguousSegment,
    NO_READING,
    pathTemplate,
    subjectFolder,
    subjectName,
    subjectsOf,
} from './subject.js';
import type { Subject } from './subject.js';

const HOLE = '\u0000';
describe('subject', () => {
    test.each(FOLDERS)(
        'subjectFolder — the standard name, derived from the subject — %s',
        (_, subject, folder) => {
            // Given - a subject a spec reaches
            // Then - the folder it is filed under, relative to its facet folder
            expect(subjectFolder(subject)).toBe(folder);
        },
    );

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
            "test('a', async () => { await api.seed(file('./_seeds/x.sql')).get('/events/42'); });",
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
        ['/indicators/btc/', undefined],
        ['/events/today', undefined],
    ])(
        'the subject a spec reaches, read statically — a word after a collection, with more path after it, reads two ways: %s → %s',
        (path, segment) => {
            // Given - a literal path sent with no template, `data` a declared collection
            const subject = { facet: 'api' as const, method: 'GET' as const, path };

            // Then - the word that may be a value, if any
            expect(ambiguousSegment(subject, { ...NO_READING, collections: ['data'] })).toBe(
                segment,
            );
        },
    );

    test('the subject a spec reaches, read statically — reads the request line of a .http the chain sends', () => {
        // Given - a request named by file(), and the disk that holds it
        const source = [
            "import { api } from '../api.specification.js';",
            "await api.request(file('./_requests/create.http'));",
        ].join('\n');

        // Then - its method and path are the subject
        expect(
            subjectsOf(source, (path) =>
                path === './_requests/create.http' ? 'POST /events\n\n{}' : undefined,
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

    test("the subject a spec reaches, read statically — a spec's cli chain reads its runner's list, handed in", () => {
        // Given - a chain running a two-word command, and the list its runner declares
        const source = [
            "import { cli } from '../cli.specification.js';",
            "await cli.exec('db migrate --dry-run');",
        ].join('\n');

        // Then - both words name the command, and the folder
        const [at] = subjectsOf(source, undefined, {
            ...NO_READING,
            commands: { cli: ['db', 'migrate'] },
        });
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
            ...NO_READING,
            commands: { db: ['db', 'migrate'], dbCli: ['db', 'migrate'] },
        }).map(({ subject }) => subjectFolder(subject));

        // Then - the first word for the plain runner, the declared words for the other and its view
        expect(folders).toStrictEqual(['db', 'db/migrate', 'db/migrate']);
    });

    test.each<[string, readonly string[], string | undefined]>([
        ['/data', [], 'data/get'],
        ['/data', ['data'], 'data/list'],
        ['/people', ['people'], 'people/list'],
        ['/data/:id', ['data'], 'data/get'],
        ['/events', ['data'], 'events/list'],
        ['/:org/:team/events', [], 'events/list'],
    ])(
        'what a repository declares — its runner commands, its irregular collections — a GET on %s with the collections %j is filed under %s',
        (path, collections, folder) => {
            // Given - a GET on one resource, and the collections the repository declares
            const subject: Subject = { facet: 'api', method: 'GET', path };

            // Then - a declared collection is listed, the plural test holding for the rest
            expect(subjectFolder(subject, { ...NO_READING, collections })).toBe(folder);
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
        const reached = subjectsOf(source, undefined, { ...NO_READING, methodless: ['/mcp'] }).map(
            ({ subject }) => [subjectName(subject), subjectFolder(subject)],
        );

        // Then - both verbs reach ALL /mcp, under mcp/, and the undeclared route keeps its verb
        expect(reached).toStrictEqual([
            ['ALL /mcp', 'mcp'],
            ['ALL /mcp', 'mcp'],
            ['GET /events', 'events/list'],
        ]);
    });

    test('the subject a spec reaches, read statically — a chain whose route, page, job or command is no literal reaches nothing', () => {
        // Given - every terminal fed a name, a relative path, or a request it cannot read
        const source = [
            "import { api, cli, job, website } from '../x.specification.js';",
            'await api.get(route);',
            "await api.get('relative');",
            'await api.request(body);',
            "await api.request(file('./_requests/head.http'));",
            "await api.request(file('./_requests/unread.http'));",
            'await website.visit(page);',
            "await website.visit('home');",
            'await job.trigger(name);',
            'await cli.exec(line);',
        ].join('\n');

        // Then - none of them has a subject
        expect(
            subjectsOf(source, (path) =>
                path === './_requests/head.http' ? 'HEAD /events' : undefined,
            ),
        ).toStrictEqual([]);
    });

    test('the subject a spec reaches, read statically — names each facet, a request file is its own route, and params mark a template where its verb reads them', () => {
        // Given - a request file on a word that reads two ways, a fetched page, a bare command, and params in each position
        const source = [
            "import { api, cli, website } from '../x.specification.js';",
            "await api.request(file('./_requests/chart.http'));",
            "await website.fetch('/feed');",
            "await cli.exec('');",
            "await api.get('/users/me/settings', { params: {} });",
            "await api.post('/users/me/settings', { params: 1 });",
            "await api.patch('/users/me/settings', {}, { params: {} });",
            "await api.get('/users/:1/settings');",
            "await api.get('/users/me/:1');",
            "await api.put('/users/me/settings', {}, { params: {} });",
            'await cli.exec();',
        ].join('\n');
        const subjects = subjectsOf(source, () => 'GET /indicators/btc/chart').map(
            ({ subject }) => subject,
        );

        // Then - each named, and filed where it reads one way
        expect(
            subjects.map((subject) => [subjectName(subject), subjectFolder(subject)]),
        ).toStrictEqual([
            ['GET /indicators/btc/chart', 'indicators/btc/chart'],
            ['visit /feed', undefined],
            ['exec (no command)', undefined],
            ['GET /users/me/settings', 'users/me/settings'],
            ['POST /users/me/settings', undefined],
            ['PATCH /users/me/settings', undefined],
            ['GET /users/:id/settings', 'users/settings'],
            ['GET /users/me/:id', undefined],
            ['PUT /users/me/settings', 'users/me/settings'],
        ]);
    });

    test('what a repository declares — a method-less route is any of the routes listed, and a command is never one', () => {
        // Given - two method-less routes, a command spelled like one, and a command of two declared words
        const source = [
            "import { api } from '../api.specification.js';",
            "import { cli } from '../cli.specification.js';",
            "await api.post('/mcp/:session', {});",
            "await cli.exec('mcp');",
            "await cli.exec('db migrate');",
        ].join('\n');

        // Then - the route reaches ALL, the commands stay commands, named by their words
        expect(
            subjectsOf(source, undefined, {
                ...NO_READING,
                commands: { cli: ['db', 'mcp', 'migrate'] },
                methodless: ['/other', '/mcp/:id'],
            }).map(({ subject }) => subjectName(subject)),
        ).toStrictEqual(['ALL /mcp/:id', 'exec mcp', 'exec db migrate']);
    });
});
