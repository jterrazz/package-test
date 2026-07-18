/**
 * MSW-based intercept server. Manages HTTP interception for spec chains.
 *
 * Intercepts are matched in order — for each incoming request, the first
 * unconsumed entry whose trigger matches (URL + optional body filter) is
 * used and consumed. This supports body-based routing to the same URL.
 *
 * Strict by construction (CONVENTIONS D7): while a chain that declared at
 * least one intercept is running, ANY outgoing HTTP request that matches no
 * registered intercept — including an exhausted queue — fails the spec with
 * an explicit error. Chains with zero intercepts never start MSW: their
 * network is not guarded (known scope).
 */
import type { InterceptEntry, MatchableRequest } from '../../core/contracts/types.js';

let mswModule: any = null;
let mswHttp: any = null;

async function loadMsw() {
    if (!mswModule) {
        mswModule = await import('msw/node');
        mswHttp = await import('msw');
    }
    return { node: mswModule, msw: mswHttp! };
}

let serverInstance: any = null;

/**
 * Start the MSW server (once per process).
 */
export async function ensureInterceptServer(): Promise<void> {
    if (serverInstance) {
        return;
    }
    const { node } = await loadMsw();
    serverInstance = node.setupServer();
    serverInstance.listen({ onUnhandledRequest: 'bypass' });
}

function describeTrigger(entry: InterceptEntry): string {
    const method = entry.trigger.method === '*' ? 'ANY' : entry.trigger.method;
    return `${method} ${String(entry.trigger.url)}`;
}

/**
 * Pure FIFO queue over the chain's intercept entries. Each observed request
 * consumes the first unconsumed entry whose URL, method, and optional body
 * matcher accept it. Exported for unit tests — MSW never reaches this class.
 */
export class InterceptQueue {
    private readonly consumed: boolean[];
    private readonly entries: InterceptEntry[];

    constructor(entries: InterceptEntry[]) {
        this.entries = entries;
        this.consumed = entries.map(() => false);
    }

    /**
     * Unique trigger URLs, preserving RegExp/string identity for MSW routing.
     * Deduped by string form — two RegExp objects with the same source are
     * one trigger (and get one handler).
     */
    get urls(): (RegExp | string)[] {
        const urls = new Map<string, RegExp | string>();
        for (const entry of this.entries) {
            const key = String(entry.trigger.url);
            if (!urls.has(key)) {
                urls.set(key, entry.trigger.url);
            }
        }
        return [...urls.values()];
    }

    /** Methods declared for a given trigger URL. */
    methodsFor(url: RegExp | string): string[] {
        const methods = new Set<string>();
        for (const entry of this.entries) {
            if (sameUrl(entry.trigger.url, url)) {
                methods.add(entry.trigger.method);
            }
        }
        return [...methods];
    }

    /**
     * Consume and return the first unconsumed entry registered for
     * `handlerUrl`/`method` that accepts the request, or null when the queue
     * for that trigger is exhausted (or no matcher accepts).
     */
    take(
        handlerUrl: RegExp | string,
        method: string,
        request: MatchableRequest,
    ): InterceptEntry | null {
        for (let i = 0; i < this.entries.length; i++) {
            if (this.consumed[i]) {
                continue;
            }
            const entry = this.entries[i];
            if (!sameUrl(entry.trigger.url, handlerUrl)) {
                continue;
            }
            if (entry.trigger.method !== method && entry.trigger.method !== '*') {
                continue;
            }
            if (entry.trigger.match && !entry.trigger.match(request)) {
                continue;
            }
            this.consumed[i] = true;
            return entry;
        }
        return null;
    }

    /**
     * Build the strict-intercept failure for a request that matched no
     * registered intercept (CONVENTIONS D7): method + URL of the offending
     * request, plus every registered trigger and its consumption state.
     */
    unmatchedError(method: string, url: string): Error {
        const triggers =
            this.entries.length === 0
                ? '  (no intercepts registered)'
                : this.entries
                      .map(
                          (entry, i) =>
                              `  - ${describeTrigger(entry)}${this.consumed[i] ? ' (already consumed)' : ''}`,
                      )
                      .join('\n');
        return new Error(
            `Unmatched outgoing HTTP request during spec: ${method} ${url}\n` +
                `Registered intercepts:\n${triggers}\n` +
                `Every outgoing request of a chain that declares intercepts must match one — ` +
                `add an .intercept() for it (or one more if its queue is exhausted).`,
        );
    }
}

function sameUrl(a: RegExp | string, b: RegExp | string): boolean {
    return a === b || String(a) === String(b);
}

/** Handle returned by {@link registerIntercepts} for the chain's lifetime. */
export interface InterceptRegistration {
    /** Remove the chain's handlers from the shared MSW server. */
    cleanup: () => void;
    /** The strict-intercept violation observed during the chain, if any. */
    violation: () => Error | null;
}

/**
 * Register intercept entries as MSW handlers for one chain. A trailing
 * catch-all handler records any request that no entry accepted — the
 * builder rethrows it as the spec failure (rejecting the action promise,
 * never an unhandled rejection).
 */
export async function registerIntercepts(
    entries: InterceptEntry[],
): Promise<InterceptRegistration> {
    if (entries.length === 0) {
        return { cleanup: () => {}, violation: () => null };
    }

    await ensureInterceptServer();
    const { msw } = await loadMsw();

    const queue = new InterceptQueue(entries);
    let violation: Error | null = null;

    const recordViolation = (method: string, url: string) => {
        violation ??= queue.unmatchedError(method, url);
        return msw.HttpResponse.json(
            { error: `@jterrazz/test strict intercepts: unmatched request ${method} ${url}` },
            { status: 501 },
        );
    };

    const handlers: any[] = [];

    for (const url of queue.urls) {
        for (const method of queue.methodsFor(url)) {
            const handlerFn =
                method === '*' ? msw.http.all : (msw.http as any)[method.toLowerCase()];
            if (!handlerFn) {
                continue;
            }

            const handler = handlerFn(url, async ({ request }: { request: Request }) => {
                let body: unknown = null;
                const rawText = await request.clone().text();
                if (rawText) {
                    try {
                        body = JSON.parse(rawText);
                    } catch {
                        // Not JSON — expose the raw text for string/RegExp filters.
                        body = rawText;
                    }
                }

                const headers: Record<string, string> = {};
                request.headers.forEach((value, key) => {
                    headers[key.toLowerCase()] = value;
                });

                const observed: MatchableRequest = { body, headers, url: request.url };
                const entry = queue.take(url, request.method, observed);
                if (!entry) {
                    // Queue exhausted for this trigger — strict failure (D7).
                    return recordViolation(request.method, request.url);
                }

                // A dynamic response is a function evaluated against the
                // Observed request at consumption time; a fixed one is used
                // As-is. Either way, one entry yields exactly one reply.
                const response =
                    typeof entry.response === 'function'
                        ? entry.response(observed)
                        : entry.response;

                if (response.delay) {
                    await new Promise((r) => setTimeout(r, response.delay));
                }

                return msw.HttpResponse.json(response.body, {
                    status: response.status ?? 200,
                    headers: response.headers,
                });
            });

            handlers.push(handler);
        }
    }

    // Catch-all LAST: any request no specific handler claimed is a strict
    // Failure. Handlers registered in one use() call are matched in order.
    handlers.push(
        msw.http.all('*', ({ request }: { request: Request }) =>
            recordViolation(request.method, request.url),
        ),
    );

    serverInstance.use(...handlers);

    return {
        cleanup: () => {
            serverInstance.resetHandlers();
        },
        violation: () => violation,
    };
}

/**
 * Stop the MSW server (call in afterAll).
 */
export async function stopInterceptServer(): Promise<void> {
    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
    }
}
