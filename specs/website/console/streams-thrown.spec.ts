import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('streams-thrown', () => {
    test('carries an uncaught exception of the page on both streams', async () => {
        // Given - a page whose script throws and logs nothing
        const result = await website.visit('/thrown');

        // Then - the exception is an error, as the component specification reports one
        expect(result.errors.text).toBe('Uncaught Error: the page broke');
        expect(result.console.text).toBe('[error] Uncaught Error: the page broke');
    });
});
