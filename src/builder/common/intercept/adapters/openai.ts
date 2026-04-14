import type { InterceptResponse, InterceptTrigger } from '../types.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

// ── Chat Completions filters ──

export interface OpenAIChatFilter {
    model?: RegExp | string;
    system?: RegExp | string;
    user?: RegExp | string;
    tools?: string[];
    temperature?: number;
}

function matchesChatFilter(body: any, filter: OpenAIChatFilter): boolean {
    if (filter.model) {
        const model = body?.model;
        if (typeof filter.model === 'string' && model !== filter.model) {
            return false;
        }
        if (filter.model instanceof RegExp && !filter.model.test(model ?? '')) {
            return false;
        }
    }
    if (filter.system) {
        const msg = body?.messages?.find((m: any) => m.role === 'system')?.content ?? '';
        if (typeof filter.system === 'string' && !msg.includes(filter.system)) {
            return false;
        }
        if (filter.system instanceof RegExp && !filter.system.test(msg)) {
            return false;
        }
    }
    if (filter.user) {
        const msg = body?.messages?.find((m: any) => m.role === 'user')?.content ?? '';
        if (typeof filter.user === 'string' && !msg.includes(filter.user)) {
            return false;
        }
        if (filter.user instanceof RegExp && !filter.user.test(msg)) {
            return false;
        }
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

export interface OpenAIResponsesFilter {
    model?: RegExp | string;
    system?: RegExp | string;
    user?: RegExp | string;
    tools?: string[];
}

function matchesResponsesFilter(body: any, filter: OpenAIResponsesFilter): boolean {
    if (filter.model) {
        const model = body?.model;
        if (typeof filter.model === 'string' && model !== filter.model) {
            return false;
        }
        if (filter.model instanceof RegExp && !filter.model.test(model ?? '')) {
            return false;
        }
    }
    if (filter.system) {
        const instructions = body?.instructions ?? '';
        const systemInput = body?.input?.find?.((m: any) => m.role === 'system')?.content ?? '';
        const text = instructions || systemInput;
        if (typeof filter.system === 'string' && !text.includes(filter.system)) {
            return false;
        }
        if (filter.system instanceof RegExp && !filter.system.test(text)) {
            return false;
        }
    }
    if (filter.user) {
        const msgs = (body?.input ?? [])
            .filter((m: any) => m.role === 'user')
            .map((m: any) =>
                typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            )
            .join(' ');
        if (typeof filter.user === 'string' && !msgs.includes(filter.user)) {
            return false;
        }
        if (filter.user instanceof RegExp && !filter.user.test(msgs)) {
            return false;
        }
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

function buildChatReply(data: unknown): InterceptResponse {
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

function buildResponsesReply(data: unknown): InterceptResponse {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return {
        status: 200,
        body: {
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
        },
    };
}

// ── Public API ──

/**
 * OpenAI API intercept helpers.
 */
export const openai = {
    /**
     * Trigger: match Chat Completions API requests.
     *
     * @example
     *   openai.request()                         // any chat call
     *   openai.request({ model: 'gpt-4o' })      // specific model
     *   openai.request({ system: /classify/ })    // system prompt match
     */
    request(filter?: OpenAIChatFilter): InterceptTrigger {
        return {
            method: 'POST',
            url: OPENAI_CHAT_URL,
            match: filter ? (body: unknown) => matchesChatFilter(body, filter) : undefined,
            wrap: buildChatReply,
        };
    },

    /**
     * Trigger: match Responses API requests (AI SDK v5+) with auto-wrapping.
     * When used with a JSON file, the data is automatically wrapped in the
     * Responses API envelope.
     *
     * @param filter - Optional body filters.
     * @param url - Custom gateway URL (default: api.openai.com).
     *
     * @example
     *   openai.agent({ user: /Report Ingestion/ }, GATEWAY)
     */
    agent(filter?: OpenAIResponsesFilter, url?: string): InterceptTrigger {
        return {
            method: 'POST',
            url: url ?? OPENAI_RESPONSES_URL,
            match: filter ? (body: unknown) => matchesResponsesFilter(body, filter) : undefined,
            wrap: buildResponsesReply,
        };
    },

    /**
     * Response: wrap data in Chat Completions format.
     *
     * @example
     *   openai.reply({ categories: ['TECH'] })
     */
    reply: buildChatReply,

    /** Response: return an OpenAI error. */
    error(status: number, message?: string): InterceptResponse {
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
    malformed(content: string): InterceptResponse {
        return buildChatReply(content);
    },

    /** Response: simulate a timeout. */
    timeout(): InterceptResponse {
        return { status: 200, body: {}, delay: 30_000 };
    },

    // ── Legacy aliases ──

    /** @deprecated Use openai.request() instead. */
    chat(filter?: OpenAIChatFilter): InterceptTrigger {
        return openai.request(filter);
    },

    /** @deprecated Use openai.reply() instead. */
    response: buildChatReply,

    /** @deprecated Use openai.agent() instead. */
    responses(filter?: OpenAIResponsesFilter, url?: string): InterceptTrigger {
        return openai.agent(filter, url);
    },

    /** @deprecated Use openai.reply() or .intercept(trigger, 'file.json') instead. */
    responsesResponse: buildResponsesReply,
};
