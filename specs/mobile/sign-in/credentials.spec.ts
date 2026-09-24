import { button, content, field } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

describe('credentials', () => {
    test('continues as the email typed into the form', async () => {
        // Given - a visitor on the sign-in screen
        const result = await mobile.open('specimen://sign-in', async (visitor) => {
            // When - they fill both fields and continue
            await visitor.fill(field('Email'), 'ada@example.com');
            await visitor.fill(field('Password'), 'hunter2');
            await visitor.tap(button('Continue'));
            await visitor.see(content('Signed in as ada@example.com'));
        });

        // Then - the screen they land on greets the address they typed
        expect(result.screen).toMatch({
            type: 'Application',
            label: 'Specimen',
            children: [
                {
                    type: 'StaticText',
                    label: 'Signed in as ada@example.com',
                },
                {
                    type: 'Button',
                    label: 'Sign out',
                },
            ],
        });
    });

    test('an empty field is found by the placeholder it shows', async () => {
        // Given - a visitor on the sign-in screen
        const result = await mobile.open('specimen://sign-in', async (visitor) => {
            // When - they name the email field by its placeholder, then continue
            await visitor.fill(field('name@example.com'), 'grace@example.com');
            await visitor.tap(button('Continue'));
            await visitor.see(content('Signed in as grace@example.com'));
        });

        // Then - what they typed reached the app
        expect(result.content.text).toBe('Signed in as grace@example.com\nSign out');
    });
});
