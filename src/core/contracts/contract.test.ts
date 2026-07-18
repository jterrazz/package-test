import { describe, expect, test } from 'vitest';

import { anthropic } from '../../integrations/anthropic/anthropic.js';
import { defineContract } from './contract.js';

describe('intercept — defineContract', () => {
    test('accepts a dynamic response function of the request', () => {
        // Given - a contract whose response derives from the observed request
        const contract = defineContract({
            response: (request) => {
                const body = request.body as { q: string };
                return anthropic.reply(`echo:${body.q}`);
            },
            trigger: anthropic.messages(),
        });

        // Then - the response is stored as the function, evaluable per request,
        // And the produced reply echoes the observed request into the Anthropic envelope
        expect(typeof contract.response).toBe('function');
        const produced =
            typeof contract.response === 'function'
                ? contract.response({ body: { q: 'hi' }, headers: {}, url: 'https://x.test/' })
                : contract.response;
        const content = (produced.body as { content: { text: string }[] }).content;
        expect(content[0].text).toBe('echo:hi');
    });

    test('builder .intercept() accepts a contract as a single argument', async () => {
        // Given - a facet with no adapters and a declared contract
        const { createApiFacet } = await import('../specification/shared/builder.js');
        const api = createApiFacet({});

        const contract = defineContract({
            response: anthropic.reply('hello'),
            trigger: anthropic.messages(),
        });

        // Then - the single-argument contract overload chains without throwing;
        // Further chaining returns the same builder
        const builder = api.intercept(contract);
        expect(builder.intercept(contract)).toBe(builder);
    });
});
