import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('tree', () => {
    test('keeps the page outline the accessibility tree draws', async () => {
        // Given - the fixture homepage, rendered
        const result = await website.visit('/');

        // Then - the outline is a golden in the dialect a component spec uses too
        expect(result.tree).toMatch(`
        - heading "Welcome" [level=1]
        - link "Articles":
          - /url: /articles
        - text: Email
        - textbox "Email"
        - text: Channel
        - combobox "Channel":
          - option "X" [selected]
          - option "LinkedIn"
        - text: Topic
        - combobox "Topic":
          - option "News" [selected]
          - option "Opinion"
        - button "Subscribe"
        - button "Clear" [disabled]`);
    });
});
