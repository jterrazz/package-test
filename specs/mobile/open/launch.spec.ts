import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

describe('launch', () => {
    test('a plain open lands on the launch screen', async () => {
        // Given - the app opened with no deep link
        const result = await mobile.open();

        // Then - the whole screen is its golden
        expect(result.screen).toMatch({
            type: 'Application',
            label: 'Specimen',
            children: [
                {
                    type: 'StaticText',
                    label: 'Welcome to Specimen',
                },
                {
                    type: 'Button',
                    label: 'Sign in',
                },
            ],
        });
    });

    test('the visible texts read top to bottom', async () => {
        // Given - the app opened with no deep link
        const result = await mobile.open();

        // Then - the content stream is what a sighted user reads, in order
        expect(result.content.text).toBe('Welcome to Specimen\nSign in');
    });
});
