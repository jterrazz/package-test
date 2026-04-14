/**
 * MSW-based intercept server. Manages HTTP interception for spec.run().
 *
 * Intercepts are matched in order — for each incoming request, the first
 * unconsumed entry whose trigger matches (URL + optional body filter) is
 * used and consumed. This supports body-based routing to the same URL.
 */
import type { InterceptEntry } from './types.js';

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

/**
 * Register intercept entries as MSW handlers. Returns a cleanup function.
 *
 * Each incoming request is matched against all unconsumed entries in order.
 * The first entry whose URL and optional body filter match is consumed.
 * This supports multiple entries for the same URL with different body matchers.
 */
export async function registerIntercepts(entries: InterceptEntry[]): Promise<() => void> {
    if (entries.length === 0) {
        return () => {};
    }

    await ensureInterceptServer();
    const { msw } = await loadMsw();

    // Track which entries have been consumed
    const consumed = Array.from({ length: entries.length }, () => false);

    // Collect unique URL patterns to register handlers for
    const urls = new Set<RegExp | string>();
    for (const entry of entries) {
        urls.add(entry.trigger.url);
    }

    const handlers: any[] = [];

    for (const url of urls) {
        // Collect all methods for this URL
        const methods = new Set<string>();
        for (const entry of entries) {
            if (entry.trigger.url === url || String(entry.trigger.url) === String(url)) {
                methods.add(entry.trigger.method);
            }
        }

        for (const method of methods) {
            const handlerFn =
                method === '*' ? msw.http.all : (msw.http as any)[method.toLowerCase()];
            if (!handlerFn) {
                continue;
            }

            const handler = handlerFn(url, async ({ request }: { request: Request }) => {
                // Clone body once for all match checks
                let body: unknown = null;
                let bodyParsed = false;

                for (let i = 0; i < entries.length; i++) {
                    if (consumed[i]) {
                        continue;
                    }

                    const entry = entries[i];

                    // Check URL matches
                    if (entry.trigger.url !== url && String(entry.trigger.url) !== String(url)) {
                        continue;
                    }

                    // Check method matches
                    if (entry.trigger.method !== method && entry.trigger.method !== '*') {
                        continue;
                    }

                    // Check body matcher if present
                    if (entry.trigger.match) {
                        if (!bodyParsed) {
                            try {
                                body = await request.clone().json();
                            } catch {
                                // Not JSON
                            }
                            bodyParsed = true;
                        }
                        if (!entry.trigger.match(body)) {
                            continue;
                        }
                    }

                    // Match found — consume and respond
                    consumed[i] = true;

                    if (entry.response.delay) {
                        await new Promise((r) => setTimeout(r, entry.response.delay));
                    }

                    return msw.HttpResponse.json(entry.response.body, {
                        status: entry.response.status ?? 200,
                        headers: entry.response.headers,
                    });
                }

                // No match — passthrough
                return undefined;
            });

            handlers.push(handler);
        }
    }

    serverInstance.use(...handlers);

    return () => {
        serverInstance.resetHandlers();
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
