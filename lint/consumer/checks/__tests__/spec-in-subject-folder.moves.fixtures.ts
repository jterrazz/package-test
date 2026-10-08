/** One website file visiting the pricing page and an article page. */
export const TWO_PAGES = [
    "import { test } from 'vitest';",
    '',
    "import { website } from '../website.specification.js';",
    '',
    "test('shows the prices', async () => {",
    "    await website.visit('/pricing', async () => {});",
    '});',
    '',
    "test('shows an article', async () => {",
    "    await website.visit('/articles/42', async () => {});",
    '});',
    '',
].join('\n');

/** A spec of one collection's listing, comparing its body against the expected file beside it. */
export const readingGround = (route: string): string =>
    [
        "import { api } from '../api.specification.js';",
        `test('answers', async () => { await expect((await api.get('/${route}')).body).toMatch(file('./__expected__/x.json')); });`,
        '',
    ].join('\n');
