import { describe, expect, test } from 'vitest';

import { doorsOf } from './spec-chains.js';

describe('spec-chains', () => {
    test('the door of a handle is the specification module it is imported from', () => {
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
});
