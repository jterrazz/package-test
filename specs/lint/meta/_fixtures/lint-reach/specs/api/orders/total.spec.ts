import { expect, test } from 'vitest';

import { myApi } from '../api.specification.js';

test('answers the total, while tripping the rules a spec reaches', async () => {
    // Given - a spec that sleeps, writes the environment, and touches the DOM
    setTimeout(() => myApi, 10);
    process.env.ORDERS = 'on';
    const node = document.querySelector('#orders');
    // Then - the assembled product is met through its entry
    expect(node).toBe(null);
});
