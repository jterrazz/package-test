import { describe, expect, test } from 'vitest';

import { anthropic } from './anthropic.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

describe('intercept — anthropic', () => {
    test('anthropic.messages() returns a trigger with the default gateway', () => {
        // Given - a bare trigger
        const trigger = anthropic.messages();

        // Then - it targets the default Anthropic endpoint
        expect(trigger.adapter).toBe('anthropic');
        expect(trigger.method).toBe('POST');
        expect(trigger.url).toBe('https://api.anthropic.com/v1/messages');
        expect(trigger.match).toBeUndefined();
    });

    test('anthropic.messages() accepts a custom gateway URL', () => {
        // Given - a custom gateway
        const trigger = anthropic.messages({}, 'https://gateway.example/v1/messages');

        // Then - the URL is overridden
        expect(trigger.url).toBe('https://gateway.example/v1/messages');
    });

    test('anthropic.messages() filter matches system prompt', () => {
        // Given - a system-prompt filter
        const trigger = anthropic.messages({ system: /journal/ });

        // Then - only bodies with a matching system prompt pass
        expect(trigger.match).toBeDefined();
        expect(
            trigger.match!({
                body: {
                    messages: [{ content: 'hi', role: 'user' }],
                    model: 'claude-sonnet-4-20250514',
                    system: 'You are a journal agent.',
                },
                headers: {},
                url: ANTHROPIC_MESSAGES_URL,
            }),
        ).toBe(true);

        expect(
            trigger.match!({
                body: {
                    messages: [{ content: 'hi', role: 'user' }],
                    model: 'claude-sonnet-4-20250514',
                    system: 'You are a coding agent.',
                },
                headers: {},
                url: ANTHROPIC_MESSAGES_URL,
            }),
        ).toBe(false);
    });

    test('anthropic.messages() filter matches first user message', () => {
        // Given - a user-message filter
        const trigger = anthropic.messages({ user: /classify/ });

        // Then - only bodies whose first user message matches pass
        expect(
            trigger.match!({
                body: { messages: [{ content: 'Please classify this article', role: 'user' }] },
                headers: {},
                url: ANTHROPIC_MESSAGES_URL,
            }),
        ).toBe(true);

        expect(
            trigger.match!({
                body: { messages: [{ content: 'hello', role: 'user' }] },
                headers: {},
                url: ANTHROPIC_MESSAGES_URL,
            }),
        ).toBe(false);
    });

    test('anthropic.messages() wrap passes fixture objects through verbatim', () => {
        // Given - a full response fixture object
        const trigger = anthropic.messages();
        const fixture = {
            content: [{ text: 'hi there', type: 'text' }],
            id: 'msg_123',
            model: 'claude-sonnet-4-20250514',
            role: 'assistant',
            stop_reason: 'end_turn',
            type: 'message',
            usage: { input_tokens: 1, output_tokens: 2 },
        };

        // Then - wrap keeps it untouched
        const response = trigger.wrap(fixture);
        expect(response.status).toBe(200);
        expect(response.body).toBe(fixture);
    });

    test('anthropic.messages() wrap falls back to buildReply for string data', () => {
        // Given - a plain string fixture
        const trigger = anthropic.messages();

        // Then - wrap builds a full message envelope
        const response = trigger.wrap('plain text reply');
        expect(response.status).toBe(200);
        expect((response.body as any).type).toBe('message');
        expect((response.body as any).content[0].text).toBe('plain text reply');
    });

    test('anthropic.messages() model filter matches by exact string equality', () => {
        // Given - a string model filter (not a RegExp)
        const trigger = anthropic.messages({ model: 'claude-sonnet-4-20250514' });
        const request = (model: string): Parameters<NonNullable<typeof trigger.match>>[0] => ({
            body: { messages: [{ content: 'hi', role: 'user' }], model },
            headers: {},
            url: ANTHROPIC_MESSAGES_URL,
        });

        // Then - only the exact model passes; a prefix or a different model does not
        expect(trigger.match!(request('claude-sonnet-4-20250514'))).toBe(true);
        expect(trigger.match!(request('claude-sonnet-4'))).toBe(false);
        expect(trigger.match!(request('claude-opus-4-20250514'))).toBe(false);
    });

    test('anthropic.messages() tools filter matches a subset of declared tool names', () => {
        // Given - a filter requiring one tool by name
        const trigger = anthropic.messages({ tools: ['get_weather'] });
        const withTools = (names: string[]): Parameters<NonNullable<typeof trigger.match>>[0] => ({
            body: {
                messages: [{ content: 'hi', role: 'user' }],
                tools: names.map((name) => ({ name })),
            },
            headers: {},
            url: ANTHROPIC_MESSAGES_URL,
        });

        // Then - present (even among others) passes; absent or no-tools fails
        expect(trigger.match!(withTools(['get_weather', 'get_time']))).toBe(true);
        expect(trigger.match!(withTools(['get_time']))).toBe(false);
        expect(trigger.match!(withTools([]))).toBe(false);
    });

    test('anthropic.messages() string-form system/user filters match by substring', () => {
        // Given - string (not RegExp) system and user filters
        const trigger = anthropic.messages({ system: 'journal', user: 'classify' });
        const request = (
            system: string,
            user: string,
        ): Parameters<NonNullable<typeof trigger.match>>[0] => ({
            body: { messages: [{ content: user, role: 'user' }], system },
            headers: {},
            url: ANTHROPIC_MESSAGES_URL,
        });

        // Then - both substrings must be present; missing either fails
        expect(trigger.match!(request('You are a journal agent.', 'please classify this'))).toBe(
            true,
        );
        expect(trigger.match!(request('You are a coding agent.', 'please classify this'))).toBe(
            false,
        );
        expect(trigger.match!(request('You are a journal agent.', 'summarize this'))).toBe(false);
    });

    test('anthropic.error() returns rate_limit_error for 429 and api_error otherwise', () => {
        // Given - a 429 and a 500 error response
        const rateLimited = anthropic.error(429);
        const serverError = anthropic.error(500, 'overloaded');

        // Then - status carries through and the error type is code-specific
        expect(rateLimited.status).toBe(429);
        expect((rateLimited.body as any).type).toBe('error');
        expect((rateLimited.body as any).error.type).toBe('rate_limit_error');
        expect((rateLimited.body as any).error.message).toBe('Anthropic error (429)');

        expect(serverError.status).toBe(500);
        expect((serverError.body as any).error.type).toBe('api_error');
        expect((serverError.body as any).error.message).toBe('overloaded');
    });

    test('anthropic.timeout() returns an empty 200 body delayed past any sane client timeout', () => {
        // Given - a simulated timeout response
        const response = anthropic.timeout();

        // Then - it resolves 200 with an empty body but only after a 30s delay
        expect(response.status).toBe(200);
        expect(response.body).toEqual({});
        expect(response.delay).toBe(30_000);
    });
});
