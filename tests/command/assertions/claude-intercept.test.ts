import { describe, expect, test } from 'vitest';

import { anthropic, claude } from '../../../src/intercept.js';

describe('intercept — claude alias', () => {
    test('claude exposes the same API surface as anthropic', () => {
        expect(Object.keys(claude).sort()).toEqual(Object.keys(anthropic).sort());
        // Methods are shared references since claude spreads anthropic.
        expect(claude.message).toBe(anthropic.message);
        expect(claude.request).toBe(anthropic.request);
        expect(claude.reply).toBe(anthropic.reply);
    });

    test('anthropic.message() returns a trigger with the default gateway', () => {
        const trigger = anthropic.message();

        expect(trigger.adapter).toBe('anthropic');
        expect(trigger.method).toBe('POST');
        expect(trigger.url).toBe('https://api.anthropic.com/v1/messages');
        expect(trigger.match).toBeUndefined();
    });

    test('anthropic.message() accepts a custom gateway URL', () => {
        const trigger = anthropic.message({}, 'https://gateway.example/v1/messages');

        expect(trigger.url).toBe('https://gateway.example/v1/messages');
    });

    test('anthropic.message() filter matches system prompt', () => {
        const trigger = anthropic.message({ system: /journal/ });

        expect(trigger.match).toBeDefined();
        expect(
            trigger.match!({
                model: 'claude-sonnet-4-20250514',
                system: 'You are a journal agent.',
                messages: [{ role: 'user', content: 'hi' }],
            }),
        ).toBe(true);

        expect(
            trigger.match!({
                model: 'claude-sonnet-4-20250514',
                system: 'You are a coding agent.',
                messages: [{ role: 'user', content: 'hi' }],
            }),
        ).toBe(false);
    });

    test('anthropic.message() filter matches first user message', () => {
        const trigger = anthropic.message({ user: /classify/ });

        expect(
            trigger.match!({
                messages: [{ role: 'user', content: 'Please classify this article' }],
            }),
        ).toBe(true);

        expect(trigger.match!({ messages: [{ role: 'user', content: 'hello' }] })).toBe(false);
    });

    test('anthropic.message() wrap passes fixture objects through verbatim', () => {
        const trigger = anthropic.message();

        const fixture = {
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'hi there' }],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 2 },
        };

        const response = trigger.wrap(fixture);

        expect(response.status).toBe(200);
        expect(response.body).toBe(fixture);
    });

    test('anthropic.message() wrap falls back to buildReply for string data', () => {
        const trigger = anthropic.message();
        const response = trigger.wrap('plain text reply');

        expect(response.status).toBe(200);
        expect((response.body as any).type).toBe('message');
        expect((response.body as any).content[0].text).toBe('plain text reply');
    });
});
