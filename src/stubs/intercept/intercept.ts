import { refusal } from '../../chain/refusals/refusal.js';
import type { StubRequest, StubResponder, StubResponse } from '../exchange.js';
import type { Stub, StubInput } from '../stub.js';
import { declared } from './declared.js';

export type StubRegistration = {
    /** Drop the handlers this registration installed. */
    cleanup: () => void;
    /** The strict-stub violation observed during the chain, if any. */
    violation: () => Error | null;
};

/** Disposed at the end of the declaring scope: handlers dropped, an unmatched request thrown. */
export type InterceptScope = AsyncDisposable;

/** What a scope may state about the network it declares. */
export type InterceptOptions = {
    /** The base a relative request resolves against for the life of the scope; under node `fetch('/api/posts')` cannot parse. */
    origin?: string;
};

/** The module-scope network double; awaited, so the network double listens before the subject runs. */
export type Intercept = ((
    stubs: StubInput,
    options?: InterceptOptions,
) => Promise<InterceptScope>) &
    ((
        request: StubRequest,
        response: StubResponder | StubResponse,
        options?: InterceptOptions,
    ) => Promise<InterceptScope>);

function isOptions(value: unknown): value is InterceptOptions {
    return (
        typeof value === 'object' && value !== null && !Array.isArray(value) && 'origin' in value
    );
}

/** Validated before anything starts, installed only once the network double listens: it sits on top of the double's `fetch` and comes off first. */
function resolveRelativeAgainst(origin: string): () => () => void {
    let base: URL;
    try {
        base = new URL(origin);
    } catch {
        throw new Error(
            refusal({
                fix: "state an absolute URL: intercept(stubs, { origin: 'http://console.test' })",
                found: `intercept(): \`origin\` is \`${origin}\`, not an absolute URL`,
                read: 'docs/17-stubs.md#intercept--the-same-double-with-no-chain',
                why: '`origin` states where a relative request resolves, so it is an absolute URL.',
            }),
        );
    }
    return () => {
        const underlying = globalThis.fetch;
        globalThis.fetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ): Promise<Response> =>
            typeof input === 'string' && input.startsWith('/')
                ? await underlying(new URL(input, base).toString(), init)
                : await underlying(input, init);
        return () => {
            globalThis.fetch = underlying;
        };
    };
}

export function interceptThrough(
    register: (stubs: readonly Stub[]) => Promise<StubRegistration>,
): Intercept {
    async function intercept(stubs: StubInput, options?: InterceptOptions): Promise<InterceptScope>;
    async function intercept(
        request: StubRequest,
        response: StubResponder | StubResponse,
        options?: InterceptOptions,
    ): Promise<InterceptScope>;
    async function intercept(
        requestOrStubs: StubInput | StubRequest,
        maybeResponseOrOptions?: InterceptOptions | StubResponder | StubResponse,
        maybeOptions?: InterceptOptions,
    ): Promise<InterceptScope> {
        const options = isOptions(maybeOptions)
            ? maybeOptions
            : isOptions(maybeResponseOrOptions)
              ? maybeResponseOrOptions
              : undefined;
        const stubs = declared(
            'intercept',
            requestOrStubs,
            isOptions(maybeResponseOrOptions) ? undefined : maybeResponseOrOptions,
        );
        if (stubs.length === 0) {
            throw new Error(
                refusal({
                    fix: 'declare at least one stub, or drop the intercept: a subject with no network needs none',
                    found: 'intercept(), and the list of stubs is empty',
                    read: 'docs/17-stubs.md#intercept--the-same-double-with-no-chain',
                    why: 'An empty list guards nothing.',
                }),
            );
        }
        const installOrigin =
            options?.origin === undefined ? undefined : resolveRelativeAgainst(options.origin);
        const registration = await register(stubs);
        const restoreOrigin = installOrigin?.();
        return {
            [Symbol.asyncDispose]: async () => {
                restoreOrigin?.();
                const violation = registration.violation();
                registration.cleanup();
                await Promise.resolve();
                if (violation) {
                    throw violation;
                }
            },
        };
    }
    return intercept;
}
