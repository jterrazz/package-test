import { component, content, http } from '@jterrazz/test';
import type { TableAccessor } from '@jterrazz/test';
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
    expect(result.content.text).toContain('Hello, world');
    expect(result.console.text).toBe('');
});

test('an empty stream is an empty text: toBeEmpty refuses a stream in the page too', async () => {
    // Given - the same reply, rendered to its end
    const result = await component
        .intercept(http.get('/api/tokens'), http.stream(['done'], { contentType: 'text/plain' }))
        .render(<TokenFeed />, async (visitor) => {
            await visitor.see(content('Complete'));
        });

    // Then - a table's matcher handed the console, past the compiler, names the form to write
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- past the compiler, which refuses a stream handed to toBeEmpty
    const table = result.console as unknown as TableAccessor;
    await expect(expect(table).toBeEmpty()).rejects.toThrow(
        /an empty stream is an empty text\n.*\nfix: compare its text: expect\(<result>\.console\.text\)\.toBe\(''\)/u,
    );
});
