import { component, content } from '@jterrazz/test';
import { http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { QuoteStatus } from './quote-status.js';

describe('QuoteStatus', () => {
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

    test('a never stub the component reaches rejects the render, naming the route and the call', async () => {
        // Given - the quote declared never requested, and a component that fetches it on mount
        const chain = component
            .intercept(http.never(http.get('/api/quote')))
            .render(<QuoteStatus />, async (visitor) => {
                await visitor.see(content('Served 418'));
            });

        // Then - the page worker served the never reply, and the render refuses the call
        await expect(chain).rejects.toThrow(
            'found: a route the chain declared never requested was reached:',
        );
        await expect(chain).rejects.toThrow('- GET /api/quote: reached by GET');
    });
});
