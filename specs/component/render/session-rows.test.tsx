import { component, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { renderSessionRows } from './session-rows.js';

describe('renderSessionRows', () => {
    test('renders a vanilla DOM list in the same browser, under the same visitor', async () => {
        // Given - a DOM function handed a container, with no React anywhere
        const result = await component.render(
            (container) => {
                renderSessionRows(container, [
                    { label: 'morning sync', tone: 'live' },
                    { label: 'evening sweep', tone: 'idle' },
                ]);
            },
            async (visitor) => {
                await visitor.see(content('morning sync'));
            },
        );

        // Then - the class tones are what the markup carries, and nothing complained
        expect(result.html.text).toContain('row row--live');
        expect(result.html.text).toContain('row row--idle');
        expect(result.errors.text).toBe('');
    });
});
