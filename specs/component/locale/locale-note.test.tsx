import { component, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { LocaleNote } from './locale-note.js';

describe('LocaleNote', () => {
    test('renders under the locale the project states', async () => {
        // Given - no chain setup: the locale comes from the component project in vitest.config.ts
        const result = await component.render(<LocaleNote />, async (visitor) => {
            await visitor.see(content('fr-FR'));
        });

        // Then - the context is the project's, not the default en-US
        expect(result.content.text).toContain('fr-FR');
    });
});
