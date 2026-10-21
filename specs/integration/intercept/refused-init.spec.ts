import { http } from '@jterrazz/test/stubs';
import { describe, expect, test } from 'vitest';

import { integration } from '../pure.specification.js';

const PRICING = 'https://pricing.spec.test';

describe('refused-init', () => {
    test.each([
        ['an empty method', { method: '' }, "'' is not a valid HTTP method."],
        ['a forbidden method', { method: 'TRACE' }, "'TRACE' HTTP method is unsupported."],
        [
            'a GET with a body',
            { body: '{}', method: 'GET' },
            'Request with GET/HEAD method cannot have body.',
        ],
    ])('refuses %s as fetch does, though a stub answers the route', async (_, init, message) => {
        // Given - a stub answering every method of the route
        const result = await integration
            .intercept(http.any(`${PRICING}/quotes`), http.json({ total: 42 }))
            .call(async () => await fetch(`${PRICING}/quotes`, init));

        // Then - the module meets fetch's own refusal, not the stub's answer
        expect(result.error).toMatch(message);
    });

    test('refuses a lower-case `patch`, which no stub can read off the wire, before it reaches the network', async () => {
        // Given - a stub for the PATCH the module meant, and a module that spells it `patch`, which fetch sends as written
        const chain = integration
            .intercept(http.patch(`${PRICING}/quotes`), http.json({ total: 42 }))
            .call(async () => {
                const reply = await fetch(`${PRICING}/quotes`, { body: '{}', method: 'patch' });
                return reply.status;
            });

        // Then - the chain fails on the request it refused, rather than the module failing to resolve a host it should never have looked up
        await expect(chain).rejects.toThrow(
            'found: an outgoing request the network double cannot read off the wire, patch https://pricing.spec.test/quotes',
        );
    });

    test('hands a streamed body to the stub whole', async () => {
        // Given - a stub taking the quote only when its body reads as sent
        const result = await integration
            .intercept(
                http.post(`${PRICING}/quotes`, { body: /^ORD-1$/u }),
                http.json({ total: 42 }),
            )
            .call(async () => {
                const streamed: RequestInit & { duplex: 'half' } = {
                    body: new Blob(['ORD-1']).stream(),
                    duplex: 'half',
                    method: 'POST',
                };
                const reply = await fetch(`${PRICING}/quotes`, streamed);
                return reply.status;
            });

        // Then - the stub answered, the stream still the call's own
        expect(result.value).toMatch(200);
    });
});
