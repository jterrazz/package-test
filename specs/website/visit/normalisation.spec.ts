import { expect, test } from 'vitest';

import { website } from '../normalisation.specification.js';

test('drops what the framework wrote into the head before the comparison', async () => {
    // Given - a page whose head carries two metas the framework owns and the spec never asked for
    const result = await website.visit('/framework');

    // Then - the golden is the head the SITE declares: the runner's transform ran before the comparison
    expect(result.head).toMatch('framework.head.json');
});

test('leaves the raw reading alone', async () => {
    // Given - the same page
    const result = await website.visit('/framework');

    // Then - the meta is still there to be read: a transform normalises what is COMPARED, never what the page said
    expect(result.meta('framework-transitions-fallback')).toBe('animate');
});
