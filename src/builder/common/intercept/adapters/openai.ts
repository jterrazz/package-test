import type { InterceptResponse, InterceptTrigger } from '../types.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export interface OpenAIChatFilter {
    /** Match by model name (exact string or regex). */
    model?: RegExp | string;
    /** Match by system message content (regex or substring). */
    system?: RegExp | string;
    /** Match by user message content (regex or substring). */
    user?: RegExp | string;
    /** Match by tool/function names present in the request. */
    tools?: string[];
    /** Match by temperature value. */
    temperature?: number;
}

function matchesFilter(body: any, filter: OpenAIChatFilter): boolean {
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
        const systemMsg = body?.messages?.find((m: any) => m.role === 'system')?.content ?? '';
        if (typeof filter.system === 'string' && !systemMsg.includes(filter.system)) {
            return false;
        }
        if (filter.system instanceof RegExp && !filter.system.test(systemMsg)) {
            return false;
        }
    }

    if (filter.user) {
        const userMsg = body?.messages?.find((m: any) => m.role === 'user')?.content ?? '';
        if (typeof filter.user === 'string' && !userMsg.includes(filter.user)) {
            return false;
        }
        if (filter.user instanceof RegExp && !filter.user.test(userMsg)) {
            return false;
        }
    }

    if (filter.tools) {
        const requestTools = body?.tools?.map((t: any) => t.function?.name).filter(Boolean) ?? [];
        if (!filter.tools.every((t) => requestTools.includes(t))) {
            return false;
        }
    }

    if (filter.temperature !== undefined && body?.temperature !== filter.temperature) {
        return false;
    }

    return true;
}

/** Responses API filter — uses `input` array instead of `messages`. */
export interface OpenAIResponsesFilter {
    /** Match by model name. */
    model?: RegExp | string;
    /** Match by system instruction content. */
    system?: RegExp | string;
    /** Match by user input content. */
    user?: RegExp | string;
    /** Match by tool names. */
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
        const systemText = instructions || systemInput;
        if (typeof filter.system === 'string' && !systemText.includes(filter.system)) {
            return false;
        }
        if (filter.system instanceof RegExp && !filter.system.test(systemText)) {
            return false;
        }
    }

    if (filter.user) {
        const userInputs = (body?.input ?? [])
            .filter((m: any) => m.role === 'user')
            .map((m: any) =>
                typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            )
            .join(' ');
        if (typeof filter.user === 'string' && !userInputs.includes(filter.user)) {
            return false;
        }
        if (filter.user instanceof RegExp && !filter.user.test(userInputs)) {
            return false;
        }
    }

    if (filter.tools) {
        const requestTools =
            body?.tools?.map((t: any) => t.name ?? t.function?.name).filter(Boolean) ?? [];
        if (!filter.tools.every((t) => requestTools.includes(t))) {
            return false;
        }
    }

    return true;
}

/**
 * OpenAI API intercept helpers.
 */
export const openai = {
    /**
     * Trigger: match OpenAI chat completion requests.
     *
     * @param filter - Optional filters to narrow which requests match.
     *
     * @example
     *   openai.chat()                                    // any chat call
     *   openai.chat({ model: 'gpt-4o' })                // specific model
     *   openai.chat({ system: /classify/ })              // system prompt contains "classify"
     *   openai.chat({ tools: ['extract_facts'] })        // function calling
     */
    chat(filter?: OpenAIChatFilter): InterceptTrigger {
        return {
            method: 'POST',
            url: OPENAI_CHAT_URL,
            match: filter ? (body: unknown) => matchesFilter(body, filter) : undefined,
        };
    },

    /**
     * Trigger: match OpenAI Responses API requests (AI SDK v5+).
     *
     * @param filter - Optional filters. Supports custom gateway URLs.
     * @param url - Override URL for custom gateways (e.g. 'https://gateway.example.com/v1/responses').
     *
     * @example
     *   openai.responses()                                                // default URL
     *   openai.responses({ user: /Report Ingestion/ })                    // match by prompt content
     *   openai.responses({ model: 'gpt-4o' }, 'https://my-gateway/v1/responses')  // custom gateway
     */
    responses(filter?: OpenAIResponsesFilter, url?: string): InterceptTrigger {
        return {
            method: 'POST',
            url: url ?? OPENAI_RESPONSES_URL,
            match: filter ? (body: unknown) => matchesResponsesFilter(body, filter) : undefined,
        };
    },

    /**
     * Response: wrap data in OpenAI Responses API format (AI SDK v5+).
     *
     * @example
     *   openai.responsesResponse({ categories: ['TECH'] })
     */
    responsesResponse(data: unknown): InterceptResponse {
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
                usage: {
                    input_tokens: 10,
                    output_tokens: 10,
                    total_tokens: 20,
                },
            },
        };
    },

    /**
     * Response: wrap data in OpenAI chat completion format.
     *
     * @param data - The content to return (will be JSON.stringified if not a string).
     *
     * @example
     *   openai.response({ categories: ['TECH'] })
     */
    response(data: unknown): InterceptResponse {
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        return {
            status: 200,
            body: {
                id: 'chatcmpl-test',
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'gpt-4o-test',
                choices: [
                    {
                        index: 0,
                        message: { role: 'assistant', content },
                        finish_reason: 'stop',
                    },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
            },
        };
    },

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

    /** Response: return malformed (non-JSON) content. */
    malformed(content: string): InterceptResponse {
        return {
            status: 200,
            body: {
                id: 'chatcmpl-test',
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'gpt-4o-test',
                choices: [
                    {
                        index: 0,
                        message: { role: 'assistant', content },
                        finish_reason: 'stop',
                    },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
            },
        };
    },

    /** Response: simulate a timeout (30s delay). */
    timeout(): InterceptResponse {
        return {
            status: 200,
            body: {},
            delay: 30_000,
        };
    },
};
