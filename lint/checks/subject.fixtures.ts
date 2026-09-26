import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { forgetTree } from '../../src/kernel/files/git-tree.js';

/** Outside every work tree: the walk reads the disk. */
export function specsTree(files: Record<string, string>): string {
    const scratch = mkdtempSync(join(tmpdir(), 'subject-'));
    const root = join(scratch, 'specs');
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    forgetTree();
    return root;
}

export const RUNNER = 'export const { api, cleanup } = await specification.api({});\n';

export const TWO_ROUTES = [
    "import { file } from '@jterrazz/test';",
    "import { describe, expect, test } from 'vitest';",
    '',
    "import { api } from '../api.specification.js';",
    '',
    "const ORDER = { item: 'book' };",
    '',
    'function listed(result) {',
    "    expect(result.response).toMatch(file('./expected/listed.http'));",
    '}',
    '',
    "describe('reading', () => {",
    "    test('lists the orders', async () => {",
    '        // Given - one order',
    "        const result = await api.seed(file('./seeds/one-order.sql')).get('/orders');",
    '',
    '        // Then - the list',
    '        listed(result);',
    '    });',
    '});',
    '',
    "describe('writing', () => {",
    "    test('creates an order', async () => {",
    '        // Given - an empty table',
    "        const result = await api.post('/orders', ORDER);",
    '',
    '        // Then - the whole response',
    "        expect(result.response).toMatch('HTTP/1.1 201 Created');",
    '    });',
    '});',
    '',
].join('\n');

export function chartSpec(terminal: string): string {
    return [
        "import { api } from '../api.specification.js';",
        `test('a', async () => { await api.${terminal}; });`,
        '',
    ].join('\n');
}

export const CHARTS = {
    'api/api.specification.ts': RUNNER,
    'api/charts/filled.spec.ts': chartSpec("get('/indicators/btc/chart?range=1D')"),
    'api/charts/templated.spec.ts': chartSpec(
        "get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })",
    ),
};

export function migrating(door: string): string {
    return [
        `import { cli } from '../${door}.specification.js';`,
        "test('a', async () => { await cli.exec('db migrate --dry-run'); });",
        '',
    ].join('\n');
}
