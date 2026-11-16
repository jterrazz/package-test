import { describe, expect, test } from 'vitest';

import { greeting } from './greeting.js';
import { userName } from './support/user.js';

describe('greet', () => {
    test('greets the user by name', () => {
        // Given - the user the helpers read from the fixtures
        const name = userName;

        // Then - the greeting names them
        expect(greeting).toBe(`Hello, ${name}`);
    });
});
