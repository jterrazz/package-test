import { component, content } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { ZoneNote } from './zone-note.js';

test('renders under the timezone the project states', async () => {
    // Given - no chain setup: the timezone comes from the component project in vitest.config.ts
    const result = await component.render(<ZoneNote />, async (visitor) => {
        await visitor.see(content('Europe/Paris'));
    });

    // Then - the context is the project's, not the default UTC
    expect(result.content.text).toContain('Europe/Paris');
});
