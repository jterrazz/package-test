/** The console posts spec: list, create and delete of one collection under /api, all three derived to one folder. */
export const CONSOLE_POSTS = [
    "import { file } from '@jterrazz/test';",
    "import { describe, expect, test } from 'vitest';",
    '',
    "import { api } from '../api.specification.js';",
    '',
    "describe('posts', () => {",
    "    test('lists the collection newest first', async () => {",
    "        const result = await api.seed(file('./__seeds__/posts.sql')).get('/api/posts');",
    '        expect(result.status).toBe(200);',
    '    });',
    '',
    "    test('creates a post', async () => {",
    "        const result = await api.post('/api/posts', {});",
    '        expect(result.status).toBe(201);',
    '    });',
    '',
    "    test('deletes a post', async () => {",
    '        const result = await api',
    "            .seed(file('./__seeds__/posts.sql'))",
    "            .delete('/api/posts/:id', { params: { id: 'post-recap' } });",
    '        expect(result.status).toBe(204);',
    '    });',
    '});',
    '',
].join('\n');

/** One route filed under misc/, beside a data file, its test reading the data as `read` writes it. */
export const besideData = (read: string): Record<string, string> => ({
    'api/misc/data.json': '[]\n',
    'api/misc/orders.spec.ts': [
        "import { api } from '../api.specification.js';",
        `test('lists', async () => { ${read}; await api.get('/orders'); });`,
        '',
    ].join('\n'),
});
