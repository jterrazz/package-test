import { describe, expect, test } from 'vitest';

import { pruned } from './spec-in-subject-folder.prune.js';

const lines = (...text: string[]): string => text.join('\n');

describe('spec-in-subject-folder.prune', () => {
    test('drops an import only a string of the file names', () => {
        // Given - a cut file whose test only names `cli` inside a string
        const cut = lines(
            "import { cli } from '../../cli/cli.specification.js';",
            "import { api } from '../api.specification.js';",
            "test('creates', async () => { await api.post('/orders', { from: 'cli-app' }); });",
            '',
        );

        // Then - the import the code never reads is gone
        expect(pruned(cut)).toBe(
            lines(
                "import { api } from '../api.specification.js';",
                "test('creates', async () => { await api.post('/orders', { from: 'cli-app' }); });",
                '',
            ),
        );
    });

    test('drops an import another clause only aliases, and an unread helper with its doc comment', () => {
        // Given - one handle imported twice under two names, and a documented helper no test calls
        const cut = lines(
            "import { api } from '../api.specification.js';",
            "import { api as other } from '../other.specification.js';",
            '',
            '/** Read the list twice. */',
            'function twice(): void {}',
            '',
            "test('lists', async () => { await other.get('/orders'); });",
            '',
        );

        // Then - only what the test reads is left
        expect(pruned(cut)).toBe(
            lines(
                "import { api as other } from '../other.specification.js';",
                '',
                "test('lists', async () => { await other.get('/orders'); });",
                '',
            ),
        );
    });

    test('keeps an import a spread reads, as it keeps one a call reads', () => {
        // Given - a cut file whose only read of a helper and a constant is a spread
        const cut = lines(
            "import { onlyPasses, FOLDERS } from '../setup.js';",
            "test('runs', async () => { await cli.with({ env: { ...onlyPasses('names') } }).exec([...FOLDERS].join(' ')); });",
            '',
        );

        // Then - nothing is pruned: a spread is no member access
        expect(pruned(cut)).toBe(cut);
    });
});
