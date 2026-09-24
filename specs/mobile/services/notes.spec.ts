import { content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { mobile, notesUrl } from '../mobile.specification.js';

describe('notes', () => {
    test('lists the notes of the API started beside the app', async () => {
        // Given - the notes screen pointed at the service the runner started
        const result = await mobile.open(`specimen://notes?api=${notesUrl}`, async (visitor) => {
            await visitor.see(content('Call the plumber'));
        });

        // Then - both notes the service serves are on screen
        expect(result.content.text).toBe('Notes\nBuy oat milk\nCall the plumber');
    });
});
