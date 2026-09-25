import { component, listitem } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { ReadingList } from './reading-list.js';

test('names a list item by its role where the list holds exactly one', async () => {
    // Given - a one-row list, so the role designates exactly one element (W3)
    const result = await component.render(<ReadingList />, async (visitor) => {
        await visitor.see(listitem());
    });

    // Then - the role named the row the list holds
    expect(result.content.text).toContain('only one');
});
