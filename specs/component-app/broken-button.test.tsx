import { button, component } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { BrokenButton } from './broken-button.js';

test('carries an uncaught exception of the page on the error stream', async () => {
    // Given - a click whose handler throws, and nothing to catch it
    const result = await component.render(<BrokenButton />, async (visitor) => {
        await visitor.click(button('Break'));
    });

    // Then - the exception is an error of the render, not a silence
    expect(result.errors.text).toContain('Uncaught Error: the handler broke');
});
