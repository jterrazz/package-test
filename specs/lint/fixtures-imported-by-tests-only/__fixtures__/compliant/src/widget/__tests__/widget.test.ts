import { describe, expect, test } from 'vitest';

import { sharedUser } from '../widget.fixtures.js';
import { greet } from '../widget.js';

describe('greet', () => {
    test('greets the user by name', () => {
        // Given - the user of the fixtures sibling
        const name = sharedUser.name;

        // Then - the greeting names them
        expect(greet(name)).toBe('Hello, Ada');
    });
});
