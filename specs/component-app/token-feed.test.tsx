import { component, content, http } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { TokenFeed } from './token-feed.js';

test('renders a streamed reply as its pieces land', async () => {
    // Given - a reply declared as three pieces, served by the page's own worker
    const result = await component
        .intercept(
            http.get('/api/tokens'),
            http.stream(['Hel', 'lo, ', 'world'], { contentType: 'text/plain', delay: 5 }),
        )
        .render(<TokenFeed />, async (visitor) => {
            await visitor.see(content('Complete'));
        });

    // Then - the panel holds every piece, in order, and said nothing else
    expect(result.content).toContain('Hello, world');
    await expect(result.console).toBeEmpty();
});
