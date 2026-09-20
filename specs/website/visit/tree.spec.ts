import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('keeps the page outline the accessibility tree draws', async () => {
    // Given - the fixture homepage, rendered
    const result = await website.visit('/');

    // Then - the outline is a golden in the dialect a component spec uses too
    expect(result.tree).toMatch('home.aria.yaml');
});
