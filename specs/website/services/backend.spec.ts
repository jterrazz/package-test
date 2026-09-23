import { content, http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../backend.specification.js';

describe('backend', () => {
    test('renders what the declared backend answered the server', async () => {
        // Given - the backend under contract for this chain
        const result = await website
            .intercept(http.get('/greeting'), http.json({ message: 'Hello from the stub' }))
            .visit('/greeting', async (visitor) => {
                await visitor.see(content('Hello from the stub'));
            });

        // Then - the page the server rendered carries the stub's answer
        expect(result.content.text).toContain('Hello from the stub');
    });
});
