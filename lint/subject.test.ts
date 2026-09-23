import { describe, expect, test } from 'vitest';

import { commandWords, pathTemplate, subjectFolder, subjectName, subjectsOf } from './subject.js';
import type { Subject } from './subject.js';

describe('subjectFolder — the standard name, derived from the subject', () => {
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
        ['a job is its name', { facet: 'jobs', job: 'digest' }, 'digest'],
        ['a cli command is its words', { command: ['db', 'migrate'], facet: 'cli' }, 'db/migrate'],
        ['a cli run with no command word has no name', { command: [], facet: 'cli' }, undefined],
        ['a page has no standard name', { facet: 'website', page: '/pricing' }, undefined],
        [
            'a journey has no standard name',
            { facet: 'mobile', journey: 'news://events' },
            undefined,
        ],
    ])('%s', (_, subject, folder) => {
        // Given - a subject a spec reaches
        // Then - the folder it is filed under, relative to its facet folder
        expect(subjectFolder(subject)).toBe(folder);
    });
});

/** A template's hole, as the reader keeps it in a literal. */
const HOLE = '\u0000';

describe('the subject a spec reaches, read statically', () => {
    test.each([
        ['/users/1', '/users/:id'],
        [`/users/${HOLE}/posts`, '/users/:id/posts'],
        ['/market/AAPL/chart', '/market/:id/chart'],
        ['/search?q=x', '/search'],
        ['/', '/'],
    ])('the path %s is the route %s', (path, template) => {
        // Given - a path as a spec writes it
        // Then - the template a route declares
        expect(pathTemplate(path)).toBe(template);
    });

    test('reads the terminal action of every chain off an imported handle, and nothing else', () => {
        // Given - a spec with two chains, a contract builder's own `.get`, and a chain in a comment
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

    test('reads the request line of a .http the chain sends', () => {
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

    test('reads a job, the words of a command, a page and a journey', () => {
        // Given - one chain of each other facet
        const source = [
            "import { cli, jobs, mobile, website } from '../x.specification.js';",
            "await jobs.trigger('digest');",
            "await cli.exec('db migrate --dry-run');",
            "await cli.exec(['build', 'serve ./dist']);",
            "await website.visit('/articles/42', async () => {});",
            "await mobile.open('news://events');",
        ].join('\n');

        // Then - each chain's subject, a cli sequence the command it opens on
        expect(subjectsOf(source).map(({ subject }) => subjectName(subject))).toStrictEqual([
            'trigger digest',
            'exec db migrate',
            'exec build',
            'visit /articles/:id',
            'open news://events',
        ]);
    });

    test.each([
        ['db migrate --dry-run', ['db', 'migrate']],
        ['--help', []],
        ['.', []],
        ['check ./src', ['check']],
    ])('the command line %j names the command %j', (line, words) => {
        // Given - a command line a chain runs
        // Then - the leading words name the command, the first argument ends it
        expect(commandWords(line)).toStrictEqual(words);
    });
});
