import { content, http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { backendUrl, mobile } from '../mobile.specification.js';

describe('backend', () => {
    test('lists the notes the declared backend answers', async () => {
        // Given - the backend under contract for this chain, handed to the app by its deep link
        const result = await mobile
            .intercept(http.get('/notes'), http.json([{ title: 'Water the plants' }]))
            .open(`specimen://notes?api=${String(backendUrl)}`, async (visitor) => {
                await visitor.see(content('Water the plants'));
            });

        // Then - the list drew the one note the stub declared
        expect(result.screen).toMatch({
            type: 'Application',
            label: 'Specimen',
            children: [
                {
                    type: 'StaticText',
                    label: 'Notes',
                },
                {
                    type: 'Other',
                    identifier: 'note-list',
                    children: [
                        {
                            type: 'StaticText',
                            label: 'Water the plants',
                        },
                    ],
                },
            ],
        });
    });

    test('a request no contract declares fails the open', async () => {
        // Given - a chain declaring nothing the notes screen reads
        const opened = mobile
            .intercept(http.get('/drafts'), http.json([]))
            .open(`specimen://notes?api=${String(backendUrl)}`, async (visitor) => {
                await visitor.see(content('Notes unavailable'));
            });

        // Then - the unmatched GET is named, not answered
        await expect(opened).rejects.toThrow(/GET \/notes/u);
    });
});
