import { isStreamBody } from '../../exchange.js';
import type { StubRequest } from '../../exchange.js';

export const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
export const RESPONSES_URL = 'https://api.openai.com/v1/responses';

export function lets(trigger: StubRequest, body: unknown, url = CHAT_URL): boolean | undefined {
    return trigger.match?.({ body, headers: {}, method: 'POST', url });
}

export function chatBody(model: string, system: string, user: string): unknown {
    return {
        messages: [
            { content: system, role: 'system' },
            { content: user, role: 'user' },
        ],
        model,
    };
}

export function toolsBody(names: string[], temperature: number): unknown {
    return {
        messages: [{ content: 'hi', role: 'user' }],
        temperature,
        tools: names.map((name) => ({ function: { name }, type: 'function' })),
    };
}

export function responsesBody(tool: unknown): unknown {
    return {
        input: [
            { content: 'Run the', role: 'user' },
            { content: 'Report Ingestion', role: 'user' },
        ],
        tools: [tool],
    };
}

export function chatCompletion(content: string): object {
    return {
        body: {
            choices: [{ finish_reason: 'stop', index: 0, message: { content, role: 'assistant' } }],
            created: 1_772_616_600,
            id: 'chatcmpl-test',
            model: 'gpt-4o-test',
            object: 'chat.completion',
            usage: { completion_tokens: 10, prompt_tokens: 10, total_tokens: 20 },
        },
        status: 200,
    };
}

export function framesOf(body: unknown): { data: unknown; event: string | undefined }[] {
    if (!isStreamBody(body)) {
        throw new Error('the reply is not a stream');
    }
    return body.chunks.map((chunk) => {
        const lines = chunk.trimEnd().split('\n');
        const field = (name: string): string =>
            lines.find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2) ?? '';
        return { data: JSON.parse(field('data')) as unknown, event: field('event') };
    });
}

export function chatChunk(delta: object, finish: null | string): string {
    return `data: ${JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1_772_616_600,
        model: 'gpt-4o-test',
        choices: [{ index: 0, delta, logprobs: null, finish_reason: finish }],
    })}\n\n`;
}

export const PART = { content_index: 0, item_id: 'msg-test', output_index: 0 };

export const ENVELOPE = {
    created_at: 1_772_616_600,
    id: 'resp-test',
    model: 'gpt-4o-test',
    object: 'response',
};

export const DONE = {
    content: [{ annotations: [], text: 'Hello', type: 'output_text' }],
    id: 'msg-test',
    role: 'assistant',
    status: 'completed',
    type: 'message',
};

export function event(type: string, sequence: number, fields: object): object {
    return { data: { ...fields, sequence_number: sequence, type }, event: type };
}
