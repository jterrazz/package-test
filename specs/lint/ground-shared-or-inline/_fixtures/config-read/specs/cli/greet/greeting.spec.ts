import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('greeting', () => {
    test('greets the name it is handed', async () => {
        // Given - a name
        const result = await cli.exec('greet ada');

        // Then - the greeting
        expect(result.stdout).toBe('hello greet');
    });
});
