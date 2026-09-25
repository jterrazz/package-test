import { component, content, http } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { QuoteStatus } from './quote-status.js';

test('a reply the component cancels unread settles, served by the page worker', async () => {
    // Given - an error reply with a body, and a component that cancels the body instead of reading it
    const result = await component
        .intercept(http.get('/api/quote'), http.error(503, { error: 'the quotes are down' }))
        .render(<QuoteStatus />, async (visitor) => {
            await visitor.see(content('Served 503'));
        });

    // Then - the cancel settled and the panel says the status it was served
    expect(result.content.text).toContain('Served 503');
    expect(result.console.text).toBe('');
});
