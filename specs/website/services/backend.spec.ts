import { content, http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../backend.specification.js';

describe('backend', () => {
    test('renders what the declared backend answered the server', async () => {
        // Given - the backend stubbed for this chain
        const result = await website
            .intercept(http.get('/greeting'), http.json({ message: 'Hello from the stub' }))
            .visit('/greeting', async (visitor) => {
                await visitor.see(content('Hello from the stub'));
            });

        // Then - the page the server rendered carries the stub's answer
        expect(result.content.text).toContain('Hello from the stub');
    });

    test('a never stub the server reaches rejects the visit, naming the route and the call', async () => {
        // Given - the backend's greeting declared never requested
        const chain = website
            .intercept(http.never(http.get('/greeting')))
            .visit('/greeting', async (visitor) => {
                await visitor.see(content('Greeting'));
            });

        // Then - the stub backend refuses the call at the end of the visit
        await expect(chain).rejects.toThrow(
            'found: a route the chain declared never requested was reached:',
        );
        await expect(chain).rejects.toThrow('- GET /greeting — reached by GET');
    });

    test('a stub forbidding a header the server sends does not answer it, and the visit is refused naming the forbidden header', async () => {
        // Given - the greeting declared only for a request without a user agent, which node's fetch always sends
        const chain = website
            .intercept(
                http.get('/greeting', { without: { headers: ['User-Agent'] } }),
                http.json({ message: 'Hello from the stub' }),
            )
            .visit('/greeting', async (visitor) => {
                await visitor.see(content('Greeting'));
            });

        // Then - the stub backend matched nothing, and lists the stub with the header it forbids
        await expect(chain).rejects.toThrow('- GET /greeting (without header user-agent)');
    });
});
