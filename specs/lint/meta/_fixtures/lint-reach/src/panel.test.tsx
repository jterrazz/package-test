import { expect, test } from 'vitest';

import { Panel } from './panel.js';

test('renders, while tripping the rules a component role reaches', () => {
    // Given - a component test that sleeps, writes the environment, and touches the DOM
    setTimeout(() => Panel(), 10);
    process.env.PANEL = 'on';
    const node = document.querySelector('#panel');
    // Then - a rendered unit legitimately meets the DOM
    expect(node).toBe(null);
});
