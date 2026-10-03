import type { Subject } from './subject.js';

/** A subject, and the folder its standard name files it under. */
export const FOLDERS: [string, Subject, string | undefined][] = [
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
    ['POST /events — created', { facet: 'api', method: 'POST', path: '/events' }, 'events/create'],
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
    ['GET / — the root names no resource', { facet: 'api', method: 'GET', path: '/' }, undefined],
    ['a job is its name', { facet: 'job', job: 'digest' }, 'digest'],
    ['a cli command is its words', { command: ['db', 'migrate'], facet: 'cli' }, 'db/migrate'],
    ['a cli run with no command word has no name', { command: [], facet: 'cli' }, undefined],
    ['a page has no standard name', { facet: 'website', page: '/pricing' }, undefined],
    ['a journey has no standard name', { facet: 'mobile', journey: 'news://events' }, undefined],
];
