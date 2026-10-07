import { describe, expect, test } from 'vitest';

import { chainsOf, doorsOf, handlesOf } from '../spec-chains.js';

describe('spec-chains', () => {
    test('the door of a handle is the specification module it is imported from', () => {
        // Given - a spec importing an api and two clis, one under another name and viewed
        const source = [
            "import { api } from '../api.specification.js';",
            "import { cli } from '../cli.specification.js';",
            "import { cli as run } from '../db-cli.specification.js';",
            'const db = run.with({});',
        ].join('\n');

        // Then - each handle's door, a view under its runner's, for the specification asked about
        expect(doorsOf(source, 'cli')).toStrictEqual({
            cli: '../cli.specification.js',
            db: '../db-cli.specification.js',
            run: '../db-cli.specification.js',
        });
        expect(doorsOf(source, 'api')).toStrictEqual({ api: '../api.specification.js' });
        expect(doorsOf(source, 'job')).toStrictEqual({});
    });

    test('a lone handle carries its door to the view bound to it', () => {
        // Given - one cli import and one view of it
        const source = [
            "import { cli } from './cli.specification.js';",
            'const db = cli.with({});',
        ].join('\n');

        // Then - the view shares the import's door
        expect(doorsOf(source, 'cli')).toStrictEqual({
            cli: './cli.specification.js',
            db: './cli.specification.js',
        });
    });

    test('the handles are the specifications a specification exports, under their local names, and every view reached from them', () => {
        // Given - a renamed import broken over lines, a non-specification import, a view of a view written first, and a view of a stranger
        const source = [
            'const deep = events.with({});',
            "import {\n    api\n        as\n    served,\n    helper,\n} from '../api.specification.js';",
            "import { cli } from './other.js';",
            'const events = served.with({});',
            'const loose = stranger.with({});',
        ].join('\n');

        // Then - the import's local name, then each view the walk reaches
        expect(handlesOf(source)).toStrictEqual(['served', 'events', 'deep']);
    });

    test('a chain is the run of calls a handle opens, each with its arguments', () => {
        // Given - two chains on one handle, one split over lines, and a handle read as a member elsewhere
        const source = [
            "await api.get('/a', { n: (1) }).expect(200);",
            'other.api.get();',
            'api\n    .post()\n    .run;',
        ].join('\n');

        // Then - each chain's calls up to the first member that is no call
        expect(chainsOf(source, ['api'])).toStrictEqual([
            {
                calls: [
                    { args: "'/a', { n: (1) }", name: 'get' },
                    { args: '200', name: 'expect' },
                ],
                end: 43,
                handle: 'api',
                index: 6,
            },
            { calls: [{ args: '', name: 'post' }], end: 77, handle: 'api', index: 62 },
        ]);
    });

    test('without a handle there is no chain', () => {
        // Given - a chain broken over lines, its handle not asked about
        const source = 'api\n    .get();';

        // Then - no chain, not even one opened by an empty name
        expect(chainsOf(source, [])).toStrictEqual([]);
    });
});
