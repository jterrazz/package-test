import { testId } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('subscribe', () => {
test('subscribes through the form', async () => {
    // Given - a visitor on the homepage
    const result = await website.visit('/', async (visitor) => {
        // testId: the embedded widget renders no accessible name and no role
        await visitor.click(testId('subscribe')); // oxlint-disable-line jterrazz/scenario-ends-settled -- an input tree of the test-id-states-what-is-missing spec: this rule is incidental to the one it feeds
    });

    // Then - the confirmation is shown
    expect(result.content).toContain('Thanks');
});
});
