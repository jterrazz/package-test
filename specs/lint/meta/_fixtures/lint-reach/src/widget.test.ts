import { expect, test } from 'vitest';

import { widget } from './widget.js';

test('names itself, while tripping one rule of each reach', () => {
    // Given - a module test that sleeps, writes the environment, and touches the DOM
    setTimeout(() => widget(), 10);
    process.env.WIDGET = 'on';
    const node = document.querySelector('#widget');
    // Then - the module role is the only one the DOM ban reaches
    expect(node).toBe(null);
});
