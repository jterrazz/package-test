import type { StubRequest, StubResponse } from '../exchange/exchange.js';
import { matchesText } from '../filters.js';
import type { TextFilter } from '../filters.js';
import { http } from '../http/http.js';
import type { SseEvent } from '../http/http.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

// ── Chat Completions filters ──

export type OpenAIChatFilter = {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
    temperature?: number;
};

function matchesChatFilter(body: any, filter: OpenAIChatFilter): boolean {
    if (!matchesText(filter.model, body?.model ?? '')) {
        return false;
    }
    if (
        !matchesText(
            filter.system,
            body?.messages?.find((m: any) => m.role === 'system')?.content ?? '',
        )
    ) {
        return false;
    }
    if (
        !matchesText(
            filter.user,
            body?.messages?.find((m: any) => m.role === 'user')?.content ?? '',
        )
    ) {
        return false;
    }
    if (filter.tools) {
        const names = body?.tools?.map((t: any) => t.function?.name).filter(Boolean) ?? [];
        if (!filter.tools.every((t) => names.includes(t))) {
            return false;
        }
    }
    if (filter.temperature !== undefined && body?.temperature !== filter.temperature) {
        return false;
    }
    return true;
}

// ── Responses API filters ──

export type OpenAIResponsesFilter = {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
};

function matchesResponsesFilter(body: any, filter: OpenAIResponsesFilter): boolean {
    if (!matchesText(filter.model, body?.model ?? '')) {
        return false;
    }
    const systemInput = body?.input?.find?.((m: any) => m.role === 'system')?.content ?? '';
    if (!matchesText(filter.system, body?.instructions || systemInput)) {
        return false;
    }
    const userText = (body?.input ?? [])
        .filter((m: any) => m.role === 'user')
        .map((m: any) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
        .join(' ');
    if (!matchesText(filter.user, userText)) {
        return false;
    }
    if (filter.tools) {
        const names =
            body?.tools?.map((t: any) => t.name ?? t.function?.name).filter(Boolean) ?? [];
        if (!filter.tools.every((t) => names.includes(t))) {
            return false;
        }
    }
    return true;
}

// ── Response builders ──

function buildChatReply(data: unknown): StubResponse {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return {
        status: 200,
        body: {
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-4o-test',
            choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        },
    };
}

/** A Responses API response whose one message's output text is `text`. */
function responsesEnvelope(text: string): Record<string, unknown> {
    return {
        id: 'resp-test',
        object: 'response',
        created_at: Math.floor(Date.now() / 1000),
        model: 'gpt-4o-test',
        output: [
            {
                type: 'message',
                id: 'msg-test',
                role: 'assistant',
                content: [{ type: 'output_text', text, annotations: [] }],
            },
        ],
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    };
}

function buildResponsesReply(data: unknown): StubResponse {
    return {
        status: 200,
        body: responsesEnvelope(typeof data === 'string' ? data : JSON.stringify(data)),
    };
}

// ── Streamed replies ──

/** Init options for a streamed OpenAI reply. */
export type OpenAIStreamInit = {
    /** The API whose stream is served — Chat Completions (default) or Responses. */
    api?: 'chat' | 'responses';
    /** Milliseconds between two events. Default 0 — every event at once. */
    delay?: number;
};

/**
 * A Chat Completions stream: one `chat.completion.chunk` per event — the
 * role first, then one content delta per piece, then the finish reason — and
 * the `[DONE]` sentinel that closes it. No event carries a name.
 */
function chatStreamEvents(pieces: readonly string[]): SseEvent[] {
    const created = Math.floor(Date.now() / 1000);
    const chunk = (delta: object, finishReason: null | string): SseEvent => ({
        data: {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created,
            model: 'gpt-4o-test',
            choices: [{ index: 0, delta, logprobs: null, finish_reason: finishReason }],
        },
    });
    return [
        chunk({ role: 'assistant', content: '' }, null),
        ...pieces.map((piece) => chunk({ content: piece }, null)),
        chunk({}, 'stop'),
        { data: '[DONE]' },
    ];
}

/**
 * A Responses stream: named events, numbered in order — the response and its
 * one message opened, one `response.output_text.delta` per piece, then every
 * part closed with the whole text, and `response.completed` last.
 */
function responsesStreamEvents(pieces: readonly string[]): SseEvent[] {
    const text = pieces.join('');
    const part = { type: 'output_text', text, annotations: [] };
    const item = { id: 'msg-test', type: 'message', role: 'assistant' };
    const done = { ...item, status: 'completed', content: [part] };
    const completed = { ...responsesEnvelope(text), status: 'completed' };
    const at = { item_id: 'msg-test', output_index: 0, content_index: 0 };
    const bodies: { [field: string]: unknown; type: string }[] = [
        {
            type: 'response.created',
            response: { ...completed, status: 'in_progress', output: [], usage: null },
        },
        {
            type: 'response.output_item.added',
            output_index: 0,
            item: { ...item, status: 'in_progress', content: [] },
        },
        { type: 'response.content_part.added', ...at, part: { ...part, text: '' } },
        ...pieces.map((delta) => ({ type: 'response.output_text.delta', ...at, delta })),
        { type: 'response.output_text.done', ...at, text },
        { type: 'response.content_part.done', ...at, part },
        { type: 'response.output_item.done', output_index: 0, item: done },
        { type: 'response.completed', response: { ...completed, output: [done] } },
    ];
    return bodies.map((body, index) => ({
        data: { ...body, sequence_number: index },
        event: body.type,
    }));
}

// ── Public API ──

/**
 * OpenAI API intercept helpers.
 */
export const openai = {
    /**
     * Request: match Chat Completions API calls. STRING filters mean EXACT
     * equality (pass the app's own prompt builder); loosen deliberately with a
     * RegExp or `match.includes(...)`.
     *
     * @example
     *   openai.chat()                            // any chat call
     *   openai.chat({ model: 'gpt-4o' })         // exact model
     *   openai.chat({ system: buildPrompt() })   // exact system prompt
     *   openai.chat({ system: /classify/ })      // pattern
     */
    chat(filter?: OpenAIChatFilter): StubRequest {
        return {
            adapter: 'openai',
            method: 'POST',
            url: OPENAI_CHAT_URL,
            match: filter ? ({ body }) => matchesChatFilter(body, filter) : undefined,
            wrap: buildChatReply,
        };
    },

    /**
     * Request: match Responses API calls (AI SDK v5+) with auto-wrapping.
     * String filters mean EXACT equality (see {@link openai.chat}).
     * When used with a JSON file, the data is automatically wrapped in the
     * Responses API envelope.
     *
     * @param filter - Optional body filters.
     * @param url - Custom gateway URL (default: api.openai.com).
     *
     * @example
     *   openai.responses({ user: /Report Ingestion/ }, GATEWAY)
     */
    responses(filter?: OpenAIResponsesFilter, url?: string): StubRequest {
        return {
            adapter: 'openai',
            method: 'POST',
            url: url ?? OPENAI_RESPONSES_URL,
            match: filter ? ({ body }) => matchesResponsesFilter(body, filter) : undefined,
            wrap: buildResponsesReply,
        };
    },

    /**
     * Response: wrap data in Chat Completions format.
     *
     * @example
     *   openai.reply({ categories: ['TECH'] })
     */
    reply(data: unknown): StubResponse {
        return buildChatReply(data);
    },

    /**
     * Response: the assistant's text STREAMED, as OpenAI serves it with
     * `stream: true` — server-sent events under `text/event-stream`, one text
     * delta per piece, in order. `api` picks the wire: Chat Completions chunks
     * closed by `[DONE]` (default), or the Responses API's named events closed
     * by `response.completed`.
     *
     * @example
     *   defineStub({ request: openai.chat(), response: openai.stream(['Hel', 'lo']) })
     *   defineStub({ request: openai.responses(), response: openai.stream(['Hi'], { api: 'responses' }) })
     */
    stream(pieces: readonly string[], init?: OpenAIStreamInit): StubResponse {
        const events =
            init?.api === 'responses' ? responsesStreamEvents(pieces) : chatStreamEvents(pieces);
        return http.sse(events, { delay: init?.delay ?? 0 });
    },

    /** Response: return an OpenAI error. */
    error(status: number, message?: string): StubResponse {
        return {
            status,
            body: {
                error: {
                    message: message ?? `OpenAI error (${status})`,
                    type: status === 429 ? 'rate_limit_error' : 'api_error',
                    code: status === 429 ? 'rate_limit_exceeded' : null,
                },
            },
        };
    },

    /** Response: return malformed content. */
    malformed(content: string): StubResponse {
        return buildChatReply(content);
    },

    /** Response: simulate a timeout. */
    timeout(): StubResponse {
        return { status: 200, body: {}, delay: 30_000 };
    },
};
