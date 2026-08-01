import { matchesText, type TextFilter } from '../../core/contracts/filters.js';
import type { ContractRequest, ContractResponse } from '../../core/contracts/types.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

// ── Chat Completions filters ──

export interface OpenAIChatFilter {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
    temperature?: number;
}

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

export interface OpenAIResponsesFilter {
    model?: TextFilter;
    system?: TextFilter;
    user?: TextFilter;
    tools?: string[];
}

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

function buildChatReply(data: unknown): ContractResponse {
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

function buildResponsesReply(data: unknown): ContractResponse {
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
    chat(filter?: OpenAIChatFilter): ContractRequest {
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
    responses(filter?: OpenAIResponsesFilter, url?: string): ContractRequest {
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
    reply: buildChatReply,

    /** Response: return an OpenAI error. */
    error(status: number, message?: string): ContractResponse {
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
    malformed(content: string): ContractResponse {
        return buildChatReply(content);
    },

    /** Response: simulate a timeout. */
    timeout(): ContractResponse {
        return { status: 200, body: {}, delay: 30_000 };
    },
};
