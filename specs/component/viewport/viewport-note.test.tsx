import { component, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { ViewportNote } from './viewport-note.js';

describe('ViewportNote', () => {
    test('renders for the page size the test gave it', async () => {
        // Given - a page narrower than the note's own breakpoint
        const result = await component
            .viewport({ height: 640, width: 400 })
            .render(<ViewportNote />, async (visitor) => {
                await visitor.see(content('Narrow layout'));
            });

        // Then - the narrow branch is what the page shows
        expect(result.content.text).toContain('Narrow layout');
    });

    test('is restored to the project size for the next test', async () => {
        // Given - no viewport of its own, after a test that narrowed the page
        const result = await component.render(<ViewportNote />, async (visitor) => {
            await visitor.see(content('Wide layout'));
        });

        // Then - the project's 1024×640 is what this render got
        expect(result.content.text).toContain('Wide layout');
        expect(result.content.text).toContain('1024×640');
    });
});
