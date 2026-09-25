import { describe, expect, test } from 'vitest';

import type { StubRequest } from '../exchange.js';
import { openai } from './openai.js';

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const RESPONSES_URL = 'https://api.openai.com/v1/responses';

/** Does the trigger's filter let this request body through? */
function lets(trigger: StubRequest, body: unknown, url = CHAT_URL): boolean | undefined {
    return trigger.match?.({ body, headers: {}, method: 'POST', url });
}

/** A chat body: the model, one system and one user message. */
function chatBody(model: string, system: string, user: string): unknown {
    return {
        messages: [
            { content: system, role: 'system' },
            { content: user, role: 'user' },
        ],
        model,
    };
}

/** A chat body declaring these function tools, at this temperature. */
function toolsBody(names: string[], temperature: number): unknown {
    return {
        messages: [{ content: 'hi', role: 'user' }],
        temperature,
        tools: names.map((name) => ({ function: { name }, type: 'function' })),
    };
}

/** A Responses body whose user text spans two inputs, declaring one tool. */
function responsesBody(tool: unknown): unknown {
    return {
        input: [
            { content: 'Run the', role: 'user' },
            { content: 'Report Ingestion', role: 'user' },
        ],
        tools: [tool],
    };
}

describe('intercept — openai chat completions', () => {
    test('openai.chat() targets the Chat Completions endpoint and matches every call', () => {
        // Given - a bare trigger
        const trigger = openai.chat();

        // Then - the default endpoint, and no filter
        expect(trigger.adapter).toBe('openai');
        expect(trigger.method).toBe('POST');
        expect(trigger.url).toBe(CHAT_URL);
        expect(trigger.match).toBeUndefined();
    });

    test('string filters match by exact equality on the model and the first system and user messages', () => {
        // Given - exact model, system and user filters
        const trigger = openai.chat({ model: 'gpt-4o', system: 'Classify.', user: 'an article' });

        // Then - the whole triple passes; a prefix or a superstring of any part does not
        expect(lets(trigger, chatBody('gpt-4o', 'Classify.', 'an article'))).toBe(true);
        expect(lets(trigger, chatBody('gpt-4o-mini', 'Classify.', 'an article'))).toBe(false);
        expect(lets(trigger, chatBody('gpt-4o', 'Classify. Then', 'an article'))).toBe(false);
        expect(lets(trigger, chatBody('gpt-4o', 'Classify.', 'an article about cats'))).toBe(false);
    });

    test('the tools filter reads function names, and the temperature filter is exact', () => {
        // Given - a filter on one tool and a temperature
        const trigger = openai.chat({ temperature: 0, tools: ['get_weather'] });

        // Then - the tool among others at the temperature passes; a missing tool or another temperature does not
        expect(lets(trigger, toolsBody(['get_time', 'get_weather'], 0))).toBe(true);
        expect(lets(trigger, toolsBody(['get_time'], 0))).toBe(false);
        expect(lets(trigger, toolsBody(['get_weather'], 0.7))).toBe(false);
    });

    test('the wrap and openai.reply() build one chat completion around the data', () => {
        // Given - an object fixture, wrapped by the trigger and by reply()
        const wrapped = openai.chat().wrap({ categories: ['TECH'] });
        const replied = openai.reply('plain text');

        // Then - the data is the assistant message's content, serialised when it is not a string
        expect(wrapped).toMatchObject({
            body: {
                choices: [
                    {
                        finish_reason: 'stop',
                        message: { content: '{"categories":["TECH"]}', role: 'assistant' },
                    },
                ],
                object: 'chat.completion',
            },
            status: 200,
        });
        expect(replied.body).toMatchObject({
            choices: [{ message: { content: 'plain text', role: 'assistant' } }],
        });
    });
});

describe('intercept — openai responses', () => {
    test('openai.responses() targets the Responses endpoint, or the gateway it is given', () => {
        // Given - a bare trigger, and one sent to a gateway
        const bare = openai.responses();
        const gateway = openai.responses({}, 'https://gateway.example/v1/responses');

        // Then - the default endpoint, then the gateway's
        expect(bare.url).toBe(RESPONSES_URL);
        expect(bare.match).toBeUndefined();
        expect(gateway.url).toBe('https://gateway.example/v1/responses');
    });

    test('the system filter reads the instructions, or a system input when there are none', () => {
        // Given - an exact system filter
        const trigger = openai.responses({ system: 'Summarise.' });

        // Then - instructions and a system input both answer; another prompt does not
        expect(lets(trigger, { input: [], instructions: 'Summarise.' }, RESPONSES_URL)).toBe(true);
        expect(
            lets(trigger, { input: [{ content: 'Summarise.', role: 'system' }] }, RESPONSES_URL),
        ).toBe(true);
        expect(lets(trigger, { input: [], instructions: 'Translate.' }, RESPONSES_URL)).toBe(false);
    });

    test('the user filter reads every user input joined, and the tools filter either name form', () => {
        // Given - a pattern on the user text and a required tool
        const trigger = openai.responses({ tools: ['search'], user: /the Report Ingestion/u });

        // Then - a flat name and a function name both count; the user text is read across inputs
        expect(lets(trigger, responsesBody({ name: 'search' }), RESPONSES_URL)).toBe(true);
        expect(lets(trigger, responsesBody({ function: { name: 'search' } }), RESPONSES_URL)).toBe(
            true,
        );
        expect(lets(trigger, responsesBody({ name: 'fetch' }), RESPONSES_URL)).toBe(false);
    });

    test('the wrap builds a Responses envelope with the data as its output text', () => {
        // Given - an object fixture
        const response = openai.responses().wrap({ ok: true });

        // Then - one assistant message whose output text is the serialised data
        expect(response).toMatchObject({
            body: {
                object: 'response',
                output: [
                    {
                        content: [{ text: '{"ok":true}', type: 'output_text' }],
                        role: 'assistant',
                        type: 'message',
                    },
                ],
            },
            status: 200,
        });
    });
});

describe('intercept — openai failures', () => {
    test('openai.error() is a rate limit on 429 and an api error otherwise', () => {
        // Given - a 429 and a 500
        const rateLimited = openai.error(429);
        const failed = openai.error(500, 'overloaded');

        // Then - the status carries through, and the error type and code are the status's
        expect(rateLimited).toStrictEqual({
            body: {
                error: {
                    code: 'rate_limit_exceeded',
                    message: 'OpenAI error (429)',
                    type: 'rate_limit_error',
                },
            },
            status: 429,
        });
        expect(failed).toStrictEqual({
            body: { error: { code: null, message: 'overloaded', type: 'api_error' } },
            status: 500,
        });
    });

    test('openai.malformed() wraps the broken content, and openai.timeout() answers after 30 s', () => {
        // Given - a malformed reply and a timeout
        const malformed = openai.malformed('{not json');
        const timeout = openai.timeout();

        // Then - the content is carried as is, and the timeout is an empty 200 delayed past any client
        expect(malformed.body).toMatchObject({
            choices: [{ message: { content: '{not json' } }],
        });
        expect(timeout).toStrictEqual({ body: {}, delay: 30_000, status: 200 });
    });
});
