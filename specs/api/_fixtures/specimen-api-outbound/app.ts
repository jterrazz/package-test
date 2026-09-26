/**
 * A specimen of the api facet whose only job is to make outgoing HTTP calls —
 * the surface the intercepts guard. Its app is Hono-compatible and in-process,
 * since intercepts are (MSW), and each of its routes is one shape of outgoing
 * traffic a stub has to answer.
 */

export const NEWS_URL = 'https://news.spec.test/api/latest';
export const QUOTES_URL = 'https://quotes.spec.test/api/quote';
export const STREAM_URL = 'https://tokens.spec.test/api/stream';
const UNREGISTERED_URL = 'https://unregistered.spec.test/thing';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

/** Every piece a streamed reply was written in, in the order it arrived. */
async function readChunks(response: Response, decoder: TextDecoder): Promise<string[]> {
    const stream = response.body;
    if (stream === null) {
        throw new Error('the provider answered with no body to read');
    }
    return await Array.fromAsync(stream, (piece: Uint8Array) => decoder.decode(piece));
}

/** One server-sent event as a client reads it: its name, when it has one, and its data line. */
type ServerEvent = { data: string; event: string | undefined };

/**
 * The events of a server-sent stream, in order — what an SDK client parses
 * before it reads a single token: frames end on a blank line, and a frame's
 * `event:` and `data:` lines are its name and its payload.
 */
async function readEvents(response: Response): Promise<ServerEvent[]> {
    const text = await response.text();
    return text
        .split('\n\n')
        .filter((frame) => frame !== '')
        .map((frame) => {
            const lines = frame.split('\n');
            const field = (name: string): string | undefined =>
                lines.find((line) => line.startsWith(`${name}: `))?.slice(name.length + 2);
            return { data: field('data') ?? '', event: field('event') };
        });
}

/** POST a streamed completion request, the way an LLM client asks for one. */
async function askStreamed(url: string): Promise<Response> {
    return await fetch(url, {
        body: JSON.stringify({ messages: [{ content: 'Say hello', role: 'user' }], stream: true }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
}

/**
 * What an assistant streamed, as the app answers it: the text assembled from
 * the deltas — the one field of the one event each provider's client reads —
 * and the event that closed the stream.
 */
function streamed(closedBy: string | undefined, deltas: string[]): Response {
    return Response.json({ closedBy, text: deltas.join('') });
}

/**
 * The routes, one per shape of outgoing traffic a stub has to answer.
 *
 * A record rather than a switch: each entry is read on its own, and adding the
 * next shape of call costs one key instead of one more branch of a function
 * nobody can hold in their head.
 */
const routes: Record<string, () => Promise<Response>> = {
    '/assistant/anthropic': async () => {
        // Anthropic's Messages stream: a `text_delta` per content_block_delta.
        const events = await readEvents(await askStreamed(ANTHROPIC_MESSAGES_URL));
        return streamed(
            events.at(-1)?.event,
            events
                .filter(({ event }) => event === 'content_block_delta')
                .map(({ data }) => JSON.parse(data).delta.text),
        );
    },
    '/assistant/openai-chat': async () => {
        // OpenAI's Chat Completions stream: unnamed chunks, then the `[DONE]` sentinel.
        const events = await readEvents(await askStreamed(OPENAI_CHAT_URL));
        return streamed(
            events.at(-1)?.data,
            events
                .filter(({ data }) => data !== '[DONE]')
                .map(({ data }) => JSON.parse(data).choices[0].delta.content ?? ''),
        );
    },
    '/assistant/openai-responses': async () => {
        // OpenAI's Responses stream: named events, the text in each output_text delta.
        const events = await readEvents(await askStreamed(OPENAI_RESPONSES_URL));
        return streamed(
            events.at(-1)?.event,
            events
                .filter(({ event }) => event === 'response.output_text.delta')
                .map(({ data }) => JSON.parse(data).delta),
        );
    },
    '/cancel': async () => {
        // The subject drops the body it did not need — what an SDK client does
        // Before a retry.
        const response = await fetch(QUOTES_URL);
        await response.body?.cancel();
        return Response.json({ status: response.status });
    },
    '/combo': async () => {
        // Two different providers in one request.
        const quoteResponse = await fetch(QUOTES_URL);
        const quote = await quoteResponse.json();
        const newsResponse = await fetch(NEWS_URL);
        const news = await newsResponse.json();
        return Response.json({ news, quote });
    },
    '/health': async () =>
        // No outgoing call at all.
        await Promise.resolve(Response.json({ ok: true })),
    '/offline': async () => {
        // The transport failing is a different branch from a status:
        // `fetch` REJECTS, and nothing about the reply can be read.
        try {
            const response = await fetch(QUOTES_URL);
            return Response.json(await response.json(), { status: response.status });
        } catch {
            return Response.json({ error: 'the quotes service did not answer' }, { status: 503 });
        }
    },
    '/other': async () => {
        // A call nobody declared an intercept for.
        const response = await fetch(UNREGISTERED_URL);
        return Response.json({ status: response.status }, { status: response.status });
    },
    '/quote': async () => {
        // One call, with a single retry on 429.
        let response = await fetch(QUOTES_URL);
        if (response.status === 429) {
            response = await fetch(QUOTES_URL);
        }
        return Response.json(await response.json(), { status: response.status });
    },
    '/quote-twice': async () => {
        // Two calls to the same provider — exhausts a one-entry queue.
        const first = await fetch(QUOTES_URL);
        const second = await fetch(QUOTES_URL);
        return Response.json({ first: first.status, second: second.status });
    },
    '/submit': async () => {
        // A POST that carries a JSON body, a custom header, and a query
        // String — the surface an http trigger filter narrows on.
        const response = await fetch(`${QUOTES_URL}?lang=en`, {
            body: JSON.stringify({ action: 'quote', user: { role: 'admin' } }),
            headers: { 'content-type': 'application/json', 'x-tenant': 'acme' },
            method: 'POST',
        });
        return Response.json(await response.json(), { status: response.status });
    },
    '/tokens': async () => {
        // A provider that answers in PIECES: the app reads them as they land,
        // Which is the whole of what a stream stub states — the chunks and
        // Their order.
        const response = await fetch(STREAM_URL);
        const decoder = new TextDecoder();
        const chunks = await readChunks(response, decoder);
        return Response.json({ chunks, contentType: response.headers.get('content-type') });
    },
};

/** Minimal Hono-compatible app — every route fans out to the network, and its table names each. */
export const outboundApp = {
    routes: Object.keys(routes).map((path) => ({ method: 'GET', path })),
    request: async (path: string): Promise<Response> => {
        const route = routes[path];
        if (route === undefined) {
            return Response.json({ error: 'not found' }, { status: 404 });
        }
        return await route();
    },
};
