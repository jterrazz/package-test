/**
 * The network double in MODULE scope — the same contracts, the same queue and
 * the same strictness as a chain's `.intercept()`, for the one kind of test
 * that has no chain to hang them on.
 *
 * A module test whose subject reaches the network had exactly two ways out
 * before this: `vi.stubGlobal('fetch')`, which replaces the platform with a
 * hand-written stand-in, or `msw/node` imported directly, which F6 refuses a
 * test and F8 refuses a consumer to declare. Both answer "what did the outside
 * world reply" in a dialect nothing else in the repository speaks.
 *
 * The scope is an `AsyncDisposable`, so the handlers come off at the end of
 * the block however the block ends — and the strict violation (an outgoing
 * request no contract accepted) is raised THERE, which is what makes the
 * double a guard rather than a convenience.
 */
import { contractsOf, isContract, isContracts } from '../../specification/contracts/contract.js';
import type { Contract, ContractInput } from '../../specification/contracts/contract.js';
import type {
    ContractRequest,
    ContractResponder,
    ContractResponse,
} from '../../specification/contracts/types.js';
import type { ContractRegistration } from './handlers.js';

/**
 * One block's worth of declared network. Disposed at the end of the scope that
 * declared it: the handlers are dropped, and an unmatched request is thrown.
 */
export type InterceptScope = AsyncDisposable;

/** What a scope may state about the network it declares. */
export type InterceptOptions = {
    /**
     * The base a RELATIVE request resolves against, for the life of the scope.
     *
     * A module that calls `fetch('/api/posts')` is browser code: under node the
     * URL cannot be parsed at all, so the request fails before any contract can
     * answer it and the test's only way out was to replace `fetch` itself. With
     * an origin stated, the relative call resolves here and the declared
     * contracts — path form or absolute — match it as they would any other.
     */
    origin?: string;
};

/**
 * The module-scope network double. Resolves once the engine is listening —
 * which is why it is a promise, and why the canonical form awaits it:
 *
 * ```typescript
 * await using _ = await intercept(http.get(url), http.json({ ok: true }));
 * ```
 *
 * Without that `await` the subject could reach the real network before the
 * first handler is in place, so the shape refuses the racy spelling: a promise
 * is not an `AsyncDisposable`, and the compiler says so.
 */
export type Intercept = ((
    contracts: ContractInput,
    options?: InterceptOptions,
) => Promise<InterceptScope>) &
    ((
        request: ContractRequest,
        response: ContractResponder | ContractResponse,
        options?: InterceptOptions,
    ) => Promise<InterceptScope>);

/**
 * The contracts a call declared, whichever of the two forms it used. Exported
 * for its own module test: the bare-request refusal is a runtime guard the
 * compiler already states, so no typed call site can reach it.
 *
 * @internal
 */
export function declared(
    requestOrContracts: ContractInput | ContractRequest,
    maybeResponse?: ContractResponder | ContractResponse,
): Contract[] {
    if (
        Array.isArray(requestOrContracts) ||
        isContracts(requestOrContracts) ||
        isContract(requestOrContracts)
    ) {
        return contractsOf(requestOrContracts);
    }
    if (maybeResponse === undefined) {
        throw new Error(
            'intercept(): a bare request needs its response — pass a contract ' +
                '(defineContract({ request, response })) or the inline pair intercept(request, response).',
        );
    }
    return [{ request: requestOrContracts, response: maybeResponse }];
}

/** Is this argument the options object rather than a response? */
function isOptions(value: unknown): value is InterceptOptions {
    return (
        typeof value === 'object' && value !== null && !Array.isArray(value) && 'origin' in value
    );
}

/**
 * Resolve every relative request against `origin` for the life of the scope.
 *
 * The framework owns the seam so a test never has to: this is the one place
 * `fetch` is wrapped, it is put back when the scope ends, and what it does is
 * the one thing a page would have done for free — turn `/api/posts` into a URL.
 */
function resolveRelativeAgainst(origin: string): () => void {
    let base: URL;
    try {
        base = new URL(origin);
    } catch {
        throw new Error(
            `intercept(): \`origin\` states where a relative request resolves — \`${origin}\` is not an absolute URL (e.g. 'http://console.test').`,
        );
    }
    const original = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
        typeof input === 'string' && input.startsWith('/')
            ? await original(new URL(input, base).toString(), init)
            : await original(input, init);
    return () => {
        globalThis.fetch = original;
    };
}

/**
 * Build the module-scope double on one engine. The node entry hands it msw's
 * server, the page's entry hands it msw's worker: one shape, two transports,
 * exactly as a chain's `.intercept()` already has it.
 *
 * @internal
 */
export function interceptThrough(
    register: (contracts: readonly Contract[]) => Promise<ContractRegistration>,
): Intercept {
    async function intercept(
        contracts: ContractInput,
        options?: InterceptOptions,
    ): Promise<InterceptScope>;
    async function intercept(
        request: ContractRequest,
        response: ContractResponder | ContractResponse,
        options?: InterceptOptions,
    ): Promise<InterceptScope>;
    async function intercept(
        requestOrContracts: ContractInput | ContractRequest,
        maybeResponseOrOptions?: ContractResponder | ContractResponse | InterceptOptions,
        maybeOptions?: InterceptOptions,
    ): Promise<InterceptScope> {
        const options = isOptions(maybeOptions)
            ? maybeOptions
            : isOptions(maybeResponseOrOptions)
              ? maybeResponseOrOptions
              : undefined;
        const contracts = declared(
            requestOrContracts,
            options === maybeResponseOrOptions
                ? undefined
                : (maybeResponseOrOptions as ContractResponder | ContractResponse | undefined),
        );
        if (contracts.length === 0) {
            throw new Error(
                'intercept(): declare at least one contract — an empty list guards nothing, ' +
                    'and a subject with no network needs no intercept at all.',
            );
        }
        const restoreOrigin =
            options?.origin === undefined ? undefined : resolveRelativeAgainst(options.origin);
        let registration;
        try {
            registration = await register(contracts);
        } catch (error) {
            restoreOrigin?.();
            throw error;
        }
        return {
            [Symbol.asyncDispose]: async () => {
                const violation = registration.violation();
                registration.cleanup();
                restoreOrigin?.();
                await Promise.resolve();
                if (violation) {
                    throw violation;
                }
            },
        };
    }
    return intercept;
}
