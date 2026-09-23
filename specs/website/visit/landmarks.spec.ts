import {
    banner,
    complementary,
    content,
    dialog,
    field,
    form,
    heading,
    link,
    listitem,
    row,
    search,
    status,
    table,
    testId,
    within,
} from '@jterrazz/test';
import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('names every landmark a page carries, and scopes an element to one', async () => {
    // Given - a page with a header, a sidebar, a named form, a search region and an open dialog
    const result = await website.visit('/landmarks', async (visitor) => {
        await visitor.see(within(banner(), heading('Landmarks')));
        await visitor.see(within(complementary('Related'), link('Articles')));
        await visitor.see(within(form('Subscribe'), field('Name')));
        await visitor.see(within(search(), field('Query')));
        await visitor.see(within(dialog('Cookies'), content('We keep none')));
    });

    // Then - each scope answered, and the page raised nothing
    expect(result.errors.text).toBe('');
});

test('names a table, its rows, a list item, a status and a test id', async () => {
    // Given - a scores table, a tag list, a status line and a canvas with no accessible name
    const result = await website.visit('/landmarks', async (visitor) => {
        await visitor.see(within(table('Scores'), row('Alice 3')));
        await visitor.see(within(listitem(), content('opinion')));
        await visitor.see(within(status(), content('Saved')));
        // testId: a canvas has no role and no accessible name
        await visitor.see(testId('chart'));
    });

    // Then - the row is the one the tree shows under the table
    expect(result.tree.text).toContain('row "Alice 3"');
});
