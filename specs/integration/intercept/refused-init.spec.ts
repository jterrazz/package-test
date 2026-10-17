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
