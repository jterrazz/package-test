import { component, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { GhostReel } from './ghost-reel.js';

describe('GhostReel', () => {
    test('shows a reader the text drawn on screen and not the text drawn at opacity 0', async () => {
        // Given - a frame with a typed line, a caption at opacity 0 holding a child, and one fading
        const result = await component.render(<GhostReel />, async (visitor) => {
            await visitor.see(content('Typed command'));
        });

        // Then - the document text keeps all three, the visible text drops the transparent caption and its child
        expect([result.content.text, result.visibleContent.text]).toStrictEqual([
            'Typed command\n\nGhost caption and its child\n\nFading caption',
            'Typed command\n\nFading caption',
        ]);
    });
});
