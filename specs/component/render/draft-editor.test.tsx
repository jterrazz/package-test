import { component, content, defineStub, http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { DraftEditor, DraftSaved } from './draft-editor.js';

const saves = defineStub({
    request: http.post('/api/draft'),
    response: http.json({ saved: true }),
});

describe('DraftEditor', () => {
    test('takes the first surface down before the second render declares its network', async () => {
        // Given - an editor that saves on unmount, rendered with the stub that answers it
        await component.intercept(saves).render(<DraftEditor />, async (visitor) => {
            await visitor.see(content('Editing a draft'));
        });

        // When - a second render, sized and with no stub, replaces it
        const result = await component
            .viewport({ height: 600, width: 500 })
            .render(<DraftSaved />, async (visitor) => {
                await visitor.see(content('Draft saved'));
            });

        // Then - the editor's save met the render it lived in, not the one that replaced it
        expect(result.content.text).toBe('Draft saved');
    });
});
