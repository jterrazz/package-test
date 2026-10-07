import { testId } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('subscribe', () => {
test('subscribes through the form', async () => {
    // Given - a visitor on the homepage
    const result = await website.visit('/', async (visitor) => {
        await visitor.click(testId('subscribe'));
    });

    // Then - the confirmation is shown
    expect(result.content).toContain('Thanks');
});
});
