import type { StubRequest, StubResponder, StubResponse } from '../exchange/exchange.js';
import type { StubRegistration } from '../network/handlers.js';
import type { Stub, StubInput } from '../stub.js';
import { declared } from './declared.js';

/** Disposed at the end of the declaring scope: handlers dropped, an unmatched request thrown. */
export type InterceptScope = AsyncDisposable;

/** What a scope may state about the network it declares. */
export type InterceptOptions = {
    /** The base a relative request resolves against for the life of the scope; under node `fetch('/api/posts')` cannot parse. */
    origin?: string;
};

/** The module-scope network double; awaited, so the engine listens before the subject runs. */
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

/** Validated before anything starts, installed only once the engine listens: it sits on top of the engine's `fetch` and comes off first. */
function resolveRelativeAgainst(origin: string): () => () => void {
    let base: URL;
    try {
        base = new URL(origin);
    } catch {
        throw new Error(
            `intercept(): \`origin\` states where a relative request resolves — \`${origin}\` is not an absolute URL (e.g. 'http://console.test').`,
        );
    }
    return () => {
        const engine = globalThis.fetch;
        globalThis.fetch = async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ): Promise<Response> =>
            typeof input === 'string' && input.startsWith('/')
                ? await engine(new URL(input, base).toString(), init)
                : await engine(input, init);
        return () => {
            globalThis.fetch = engine;
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
            options === maybeResponseOrOptions
                ? undefined
                : (maybeResponseOrOptions as StubResponder | StubResponse | undefined),
        );
        if (stubs.length === 0) {
            throw new Error(
                'intercept(): declare at least one stub — an empty list guards nothing, ' +
                    'and a subject with no network needs no intercept at all.',
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
