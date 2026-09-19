/**
 * One contract engine, two runtimes.
 *
 * msw runs the same handler shape in node (`setupServer`) and in a page
 * (`setupWorker`), so what a contract BECOMES — the route, the body kind, the
 * strict catch-all, the queue's selection — is stated once here and handed to
 * whichever side is starting. A second copy of this would be a second answer
 * to "which contract answers this request", and the facets would drift.
 *
 * Typed loosely on purpose: `msw` is reached through a lazy import by both
 * sides (it is a dependency, never a peer), and the namespace it returns is
 * the seam's to describe, not the model's.
 */
import type { Contract } from '../../specification/contracts/contract.js';
import { ContractQueue } from '../../specification/contracts/queue.js';
import type { ContractResponse, MatchableRequest } from '../../specification/contracts/types.js';

/* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- the msw namespace crosses a lazy import: this module IS the boundary that gives it a shape */

/** What a started engine hands back for the lifetime of one chain. */
export type ContractRegistration = {
    /** Remove the chain's handlers from the shared engine. */
    cleanup: () => void;
    /** The strict-contract violation observed during the chain, if any. */
    violation: () => Error | null;
};

/**
 * What a chain with zero contracts gets: nothing was declared, so nothing is
 * guarded and nothing has to be torn down (known scope, CONVENTIONS D7).
 */
export const NO_CONTRACTS: ContractRegistration = {
    cleanup: () => {},
    violation: () => null,
};

/**
 * A contract answers the request that was made, never a copy of an earlier one.
 *
 * In a page the reply travels through a real service worker and a real HTTP
 * cache, so a second render of the same component can be served the FIRST
 * test's answer and never reach the queue at all — a contract that was
 * exhausted, or replaced, silently keeps answering. Stated as a default, so a
 * spec whose subject IS caching can still say otherwise.
 */
const NEVER_CACHED = { 'cache-control': 'no-store' };

/** Turn a contract response into the msw reply, body kind by body kind. */
export function toMswResponse(msw: any, response: ContractResponse): unknown {
    const { body, headers, status = 200 } = response;
    if (body === null || body === undefined) {
        return new msw.HttpResponse(null, { headers: { ...NEVER_CACHED, ...headers }, status });
    }
    if (typeof body === 'string') {
        return new msw.HttpResponse(body, {
            headers: { ...NEVER_CACHED, 'content-type': 'text/plain; charset=utf-8', ...headers },
            status,
        });
    }
    return msw.HttpResponse.json(body, { headers: { ...NEVER_CACHED, ...headers }, status });
}

/**
 * The handlers one chain's contracts become, plus the trailing catch-all that
 * records any request no contract accepted (CONVENTIONS D7: strict from the
 * first contract). The caller decides what to do with the recorded violation —
 * the api chain rethrows it, the component chain fails the render.
 *
 * `bypass` names the traffic that is not the subject's: under node there is
 * none, in a page it is everything the runner fetches to BE a page.
 */
export function buildContractHandlers(
    msw: any,
    contracts: readonly Contract[],
    bypass?: (url: string) => boolean,
): { handlers: unknown[]; violation: () => Error | null } {
    const queue = new ContractQueue(contracts);
    let violation: Error | null = null;

    const recordViolation = (method: string, url: string): unknown => {
        violation ??= queue.unmatchedError(method, url);
        return msw.HttpResponse.json(
            { error: `@jterrazz/test strict contracts: unmatched request ${method} ${url}` },
            { headers: NEVER_CACHED, status: 501 },
        );
    };

    const handlers: unknown[] = [];
    for (const route of queue.routes) {
        for (const method of route.methods) {
            const handlerFn = method === '*' ? msw.http.all : msw.http[method.toLowerCase()];
            if (!handlerFn) {
                continue;
            }
            handlers.push(
                handlerFn(route.url, async ({ request }: { request: Request }) => {
                    const observed = await observe(request);
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
                        await new Promise((resolve) => setTimeout(resolve, response.delay));
                    }
                    return toMswResponse(msw, response);
                }),
            );
        }
    }

    // Catch-all LAST: any request no specific handler claimed is a strict
    // Failure. Handlers registered in one use() call are matched in order.
    //
    // `bypass` is what keeps the engine from eating the RUNNER's own traffic:
    // In a page every module is an HTTP request, the dependency cache included,
    // And a 501 to one of those stops the run rather than failing a spec.
    handlers.push(
        msw.http.all('*', ({ request }: { request: Request }) =>
            bypass?.(request.url) === true
                ? msw.passthrough()
                : recordViolation(request.method, request.url),
        ),
    );

    return { handlers, violation: () => violation ?? queue.requiredError() };
}

/** The request as the queue matches it — body parsed when it is JSON. */
async function observe(request: Request): Promise<MatchableRequest> {
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
    return { body, headers, method: request.method.toUpperCase(), url: request.url };
}
