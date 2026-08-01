/**
 * MSW-based contract engine. Registers one chain's contracts as MSW handlers
 * and serves them through the shared {@link ContractQueue} — the SAME queue
 * the declared stub backend (website/mobile) consumes, so selection semantics
 * never diverge between engines.
 *
 * Strict by construction (CONVENTIONS D7): while a chain that declared at
 * least one contract is running, ANY outgoing HTTP request that matches no
 * contract — including one whose every matching contract is exhausted — fails
 * the spec with an explicit error. Chains with zero contracts never start MSW:
 * their network is not guarded (known scope).
 */
import type { Contract } from '../../core/contracts/contract.js';
import { ContractQueue } from '../../core/contracts/queue.js';
import type { ContractResponse, MatchableRequest } from '../../core/contracts/types.js';

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
export async function ensureContractServer(): Promise<void> {
    if (serverInstance) {
        return;
    }
    const { node } = await loadMsw();
    serverInstance = node.setupServer();
    serverInstance.listen({ onUnhandledRequest: 'bypass' });
}

/** Handle returned by {@link registerContracts} for the chain's lifetime. */
export interface ContractRegistration {
    /** Remove the chain's handlers from the shared MSW server. */
    cleanup: () => void;
    /** The strict-contract violation observed during the chain, if any. */
    violation: () => Error | null;
}

/** Turn a contract response into the MSW reply, body kind by body kind. */
function toMswResponse(msw: any, response: ContractResponse): unknown {
    const { body, headers, status = 200 } = response;
    if (body === null || body === undefined) {
        return new msw.HttpResponse(null, { headers, status });
    }
    if (typeof body === 'string') {
        return new msw.HttpResponse(body, {
            headers: { 'content-type': 'text/plain; charset=utf-8', ...headers },
            status,
        });
    }
    return msw.HttpResponse.json(body, { headers, status });
}

/**
 * Register a chain's contracts as MSW handlers. A trailing catch-all handler
 * records any request no contract accepted — the builder rethrows it as the
 * spec failure (rejecting the action promise, never an unhandled rejection).
 */
export async function registerContracts(
    contracts: readonly Contract[],
): Promise<ContractRegistration> {
    if (contracts.length === 0) {
        return { cleanup: () => {}, violation: () => null };
    }

    await ensureContractServer();
    const { msw } = await loadMsw();

    const queue = new ContractQueue(contracts);
    let violation: Error | null = null;

    const recordViolation = (method: string, url: string) => {
        violation ??= queue.unmatchedError(method, url);
        return msw.HttpResponse.json(
            { error: `@jterrazz/test strict contracts: unmatched request ${method} ${url}` },
            { status: 501 },
        );
    };

    const handlers: any[] = [];

    for (const route of queue.routes) {
        for (const method of route.methods) {
            const handlerFn =
                method === '*' ? msw.http.all : (msw.http as any)[method.toLowerCase()];
            if (!handlerFn) {
                continue;
            }

            const handler = handlerFn(route.url, async ({ request }: { request: Request }) => {
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

                const observed: MatchableRequest = {
                    body,
                    headers,
                    method: request.method.toUpperCase(),
                    url: request.url,
                };
                const contract = queue.take(observed);
                if (!contract) {
                    // Nothing matches, or everything that matches is spent (D7).
                    return recordViolation(request.method, request.url);
                }

                // A dynamic response is a function evaluated against the
                // Observed request at serve time; a fixed one is used as-is.
                const response =
                    typeof contract.response === 'function'
                        ? contract.response(observed)
                        : contract.response;

                if (response.delay) {
                    await new Promise((r) => setTimeout(r, response.delay));
                }

                return toMswResponse(msw, response);
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
        violation: () => violation ?? queue.requiredError(),
    };
}

/**
 * Stop the MSW server (call in afterAll).
 */
export async function stopContractServer(): Promise<void> {
    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
    }
}
