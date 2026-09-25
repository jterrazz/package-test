import { describe, expect, test } from 'vitest';

import { isStreamBody } from '../exchange/exchange.js';
import { anthropic } from './anthropic.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

function frame(data: { [field: string]: unknown; type: string }): string {
    return `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;
}
describe('anthropic', () => {
    test('intercept — anthropic — anthropic.messages() returns a trigger with the default gateway', () => {
        // Given - a bare trigger
        const trigger = anthropic.messages();

        // Then - it targets the default Anthropic endpoint
        expect(trigger.adapter).toBe('anthropic');
        expect(trigger.method).toBe('POST');
        expect(trigger.url).toBe('https://api.anthropic.com/v1/messages');
        expect(trigger.match).toBeUndefined();
    });

    test('intercept — anthropic — anthropic.messages() accepts a custom gateway URL', () => {
        // Given - a custom gateway
        const trigger = anthropic.messages({}, 'https://gateway.example/v1/messages');

        // Then - the URL is overridden
        expect(trigger.url).toBe('https://gateway.example/v1/messages');
    });

    test('intercept — anthropic — anthropic.messages() filter matches system prompt', () => {
        // Given - a system-prompt filter
        const trigger = anthropic.messages({ system: /journal/u });

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
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            }),
        ).toBeTruthy();

        expect(
            trigger.match!({
                body: {
                    messages: [{ content: 'hi', role: 'user' }],
                    model: 'claude-sonnet-4-20250514',
                    system: 'You are a coding agent.',
                },
                headers: {},
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            }),
        ).toBeFalsy();
    });

    test('intercept — anthropic — anthropic.messages() filter matches first user message', () => {
        // Given - a user-message filter
        const trigger = anthropic.messages({ user: /classify/u });

        // Then - only bodies whose first user message matches pass
        expect(
            trigger.match!({
                body: { messages: [{ content: 'Please classify this article', role: 'user' }] },
                headers: {},
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            }),
        ).toBeTruthy();

        expect(
            trigger.match!({
                body: { messages: [{ content: 'hello', role: 'user' }] },
                headers: {},
                method: 'POST',
                url: ANTHROPIC_MESSAGES_URL,
            }),
        ).toBeFalsy();
    });

    test('intercept — anthropic — anthropic.messages() wrap passes fixture objects through verbatim', () => {
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

    test('intercept — anthropic — anthropic.messages() wrap falls back to buildReply for string data', () => {
        // Given - a plain string fixture
        const trigger = anthropic.messages();

        // Then - wrap builds a full message envelope
        const response = trigger.wrap('plain text reply');
        expect(response.status).toBe(200);
        expect((response.body as any).type).toBe('message');
        expect((response.body as any).content[0].text).toBe('plain text reply');
    });

    test('intercept — anthropic — anthropic.messages() model filter matches by exact string equality', () => {
        // Given - a string model filter (not a RegExp)
        const trigger = anthropic.messages({ model: 'claude-sonnet-4-20250514' });
        const request = (model: string): Parameters<NonNullable<typeof trigger.match>>[0] => ({
            body: { messages: [{ content: 'hi', role: 'user' }], model },
            headers: {},
            method: 'POST',
            url: ANTHROPIC_MESSAGES_URL,
        });

        // Then - only the exact model passes; a prefix or a different model does not
        expect(trigger.match!(request('claude-sonnet-4-20250514'))).toBeTruthy();
        expect(trigger.match!(request('claude-sonnet-4'))).toBeFalsy();
        expect(trigger.match!(request('claude-opus-4-20250514'))).toBeFalsy();
    });

    test('intercept — anthropic — anthropic.messages() tools filter matches a subset of declared tool names', () => {
        // Given - a filter requiring one tool by name
        const trigger = anthropic.messages({ tools: ['get_weather'] });
        const withTools = (names: string[]): Parameters<NonNullable<typeof trigger.match>>[0] => ({
            body: {
                messages: [{ content: 'hi', role: 'user' }],
                tools: names.map((name) => ({ name })),
            },
            headers: {},
            method: 'POST',
            url: ANTHROPIC_MESSAGES_URL,
        });

        // Then - present (even among others) passes; absent or no-tools fails
        expect(trigger.match!(withTools(['get_weather', 'get_time']))).toBeTruthy();
        expect(trigger.match!(withTools(['get_time']))).toBeFalsy();
        expect(trigger.match!(withTools([]))).toBeFalsy();
    });

    test('intercept — anthropic — anthropic.messages() string-form system/user filters match by EXACT equality', () => {
        // Given - string (not RegExp) system and user filters — v11 makes them exact
        const trigger = anthropic.messages({
            system: 'You are a journal agent.',
            user: 'please classify this',
        });
        const request = (
            system: string,
            user: string,
        ): Parameters<NonNullable<typeof trigger.match>>[0] => ({
            body: { messages: [{ content: user, role: 'user' }], system },
            headers: {},
            method: 'POST',
            url: ANTHROPIC_MESSAGES_URL,
        });

        // Then - both must match whole; a superstring is NOT a match anymore
        expect(
            trigger.match!(request('You are a journal agent.', 'please classify this')),
        ).toBeTruthy();
        expect(
            trigger.match!(request('You are a journal agent.', 'please classify this article')),
        ).toBeFalsy();
        expect(
            trigger.match!(request('You are a coding agent.', 'please classify this')),
        ).toBeFalsy();
    });

    test('intercept — anthropic — anthropic.error() returns rate_limit_error for 429 and api_error otherwise', () => {
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

    test('intercept — anthropic — anthropic.timeout() returns an empty 200 body delayed past any sane client timeout', () => {
        // Given - a simulated timeout response
        const response = anthropic.timeout();

        // Then - it resolves 200 with an empty body but only after a 30s delay
        expect(response.status).toBe(200);
        expect(response.body).toStrictEqual({});
        expect(response.delay).toBe(30_000);
    });

    test('intercept — anthropic streamed replies — stream() serves the Messages events — one text_delta per piece — closed by message_stop', () => {
        // Given - two pieces
        const response = anthropic.stream(['Hel', 'lo'], { delay: 5 });
        if (!isStreamBody(response.body)) {
            throw new Error('the reply is not a stream');
        }

        // Then - each event is named for its type, the deltas are the pieces in order, and the stream ends on message_stop
        expect(response.body.chunks).toStrictEqual([
            frame({
                type: 'message_start',
                message: {
                    id: 'msg-test',
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: 'claude-sonnet-4-20250514',
                    stop_reason: null,
                    stop_sequence: null,
                    usage: { input_tokens: 10, output_tokens: 1 },
                },
            }),
            frame({
                type: 'content_block_start',
                index: 0,
                content_block: { type: 'text', text: '' },
            }),
            frame({ type: 'ping' }),
            frame({
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: 'Hel' },
            }),
            frame({
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'text_delta', text: 'lo' },
            }),
            frame({ type: 'content_block_stop', index: 0 }),
            frame({
                type: 'message_delta',
                delta: { stop_reason: 'end_turn', stop_sequence: null },
                usage: { output_tokens: 10 },
            }),
            frame({ type: 'message_stop' }),
        ]);
        expect({
            contentType: response.body.contentType,
            delay: response.body.delayBetweenChunks,
            headers: response.headers,
            status: response.status,
        }).toStrictEqual({
            contentType: 'text/event-stream',
            delay: 5,
            headers: { 'cache-control': 'no-cache' },
            status: 200,
        });
    });
});
