import { button, component } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { BrokenButton } from './broken-button.js';

describe('BrokenButton', () => {
    test('carries an uncaught exception of the page on the error stream', async () => {
        // Given - a click whose handler throws, and nothing to catch it
        const result = await component.render(<BrokenButton />, async (visitor) => {
            await visitor.click(button('Break'));
        });

        // Then - the exception is one error of the render, not a silence nor a pair
        expect(result.errors.text).toBe('Uncaught Error: the handler broke');
    });
});
