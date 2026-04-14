/**
 * MSW-based intercept server. Manages HTTP interception for spec.run().
 *
 * Intercepts are queued per trigger — the first matching handler is consumed,
 * then the next one in the queue is used for subsequent matching requests.
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
 * Handlers are consumed in queue order — each trigger match pops one response.
 */
export async function registerIntercepts(entries: InterceptEntry[]): Promise<() => void> {
    if (entries.length === 0) {
        return () => {};
    }

    await ensureInterceptServer();
    const { msw } = await loadMsw();

    // Build a queue per unique trigger (same method+url+match combo)
    const queues = new Map<string, InterceptEntry[]>();
    for (const entry of entries) {
        const key = `${entry.trigger.method}:${entry.trigger.url}`;
        const existing = queues.get(key) ?? [];
        existing.push(entry);
        queues.set(key, existing);
    }

    const handlers: any[] = [];

    for (const [, queue] of queues) {
        let index = 0;
        const trigger = queue[0].trigger;

        const handler =
            trigger.method === '*'
                ? msw.http.all(
                      trigger.url instanceof RegExp ? trigger.url : trigger.url,
                      createResolver(
                          queue,
                          () => index,
                          () => {
                              index++;
                          },
                      ),
                  )
                : (msw.http as any)[trigger.method.toLowerCase()](
                      trigger.url instanceof RegExp ? trigger.url : trigger.url,
                      createResolver(
                          queue,
                          () => index,
                          () => {
                              index++;
                          },
                      ),
                  );

        handlers.push(handler);
    }

    serverInstance.use(...handlers);

    return () => {
        serverInstance.resetHandlers();
    };

    function createResolver(queue: InterceptEntry[], getIndex: () => number, advance: () => void) {
        return async ({ request }: { request: Request }) => {
            const idx = getIndex();
            if (idx >= queue.length) {
                // Queue exhausted — passthrough
                return undefined;
            }

            const entry = queue[idx];

            // Check body matcher if present
            if (entry.trigger.match) {
                let body: unknown = null;
                try {
                    body = await request.clone().json();
                } catch {
                    // Not JSON — skip match
                }
                if (!entry.trigger.match(body)) {
                    return undefined;
                }
            }

            advance();

            // Apply delay if specified
            if (entry.response.delay) {
                await new Promise((r) => setTimeout(r, entry.response.delay));
            }

            const { HttpResponse } = await loadMsw().then((m) => m.msw);
            return HttpResponse.json(entry.response.body, {
                status: entry.response.status ?? 200,
                headers: entry.response.headers,
            });
        };
    }
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
