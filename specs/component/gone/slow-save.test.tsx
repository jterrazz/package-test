import { button, component, content } from '@jterrazz/test';
import { defineStub, http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { SlowSave } from './slow-save.js';

const slowWrite = defineStub({
    request: http.post('/api/save'),
    response: http.json({ ok: true }, { delay: 2000 }),
});

describe('SlowSave', () => {
    test('waits the test budget for a thing to go, not a poll default of one second', async () => {
        // Given - a button that leaves the screen only when a slow write returns
        const result = await component
            .intercept(slowWrite)
            .render(<SlowSave />, async (visitor) => {
                await visitor.click(button('Save'));
                await visitor.gone(button('Save'));
                await visitor.see(content('Saved'));
            });

        // Then - the absence was waited out, the way every other verb waits
        expect(result.content.text).toContain('Saved');
        expect(result.errors.text).toBe('');
    });
});
