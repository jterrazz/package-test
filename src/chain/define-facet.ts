import type { Action, AnyAction } from './action.js';
import type {
    AnyCapability,
    Capability,
    ContextKey,
    Intersect,
    MatrixRow,
    SetupContext,
    Sharing,
} from './capability.js';
import type { ChainConfig } from './config.js';
import { perform } from './perform.js';
import { applied, EMPTY_STATE } from './state.js';
import type { ChainState } from './state.js';

export type Composition = {
    readonly actions: readonly AnyAction[];
    readonly capabilities: readonly (AnyCapability | Sharing)[];
    readonly options: Readonly<Record<string, MatrixRow>>;
};

type NeedsOf<Member> =
    Member extends Capability<
        string,
        infer _Slice,
        infer _Args,
        infer _Signature,
        infer Needs,
        infer _Context
    >
        ? Needs
        : Member extends Action<string, infer _Args, infer _Result, infer _Signature, infer Needs>
          ? Needs
          : unknown;

type AdaptersOf<C extends Composition> = Intersect<
    NeedsOf<C['actions'][number] | C['capabilities'][number]>
>;

type MemberNames<C extends Composition> =
    | C['actions'][number]['name']
    | C['capabilities'][number]['name'];

type SameMembers<Self, C extends Composition> = [keyof Self] extends [MemberNames<C>]
    ? [MemberNames<C>] extends [keyof Self]
        ? unknown
        : { readonly composedButNotOnTheChain: Exclude<MemberNames<C>, keyof Self> }
    : { readonly onTheChainButNotComposed: Exclude<keyof Self, MemberNames<C>> };

type Wiring<C extends Composition, Config extends ChainConfig> = {
    /** Typed as written: a parameter left to context makes the facet context-sensitive, and the composition is then not inferred. */
    readonly adapters: (config: Config) => AdaptersOf<C> & object;
    readonly locate: () => string;
};

type Facet<Self, Config extends ChainConfig> = {
    readonly composition: Composition;
    readonly open: (config: Config) => Self;
};

type FacetDefiner<Self, Config extends ChainConfig> = <const C extends Composition>(
    facet: C & SameMembers<Self, C> & Wiring<C, Config>,
) => Facet<Self, Config>;

type Wired = Composition & Pick<Wiring<Composition, ChainConfig>, 'locate'>;

/** Each setup a shared setting names, applied as if called with it; a setting no setup names is ignored. */
function withSharedSettings(
    setups: readonly AnyCapability[],
    state: ChainState,
    context: Partial<Record<ContextKey, unknown>>,
    setup: SetupContext<object>,
): ChainState {
    let next = state;
    for (const capability of setups) {
        // Stryker disable next-line ConditionalExpression: no shared setting is keyed by the text of an absent context
        const value = capability.context === undefined ? undefined : context[capability.context];
        if (value !== undefined) {
            next = applied(next, capability, [value], setup);
        }
    }
    return next;
}

/** `with()` leaves the directory unfixed, so a context written in a helper file never anchors the paths of the test using it. */
function chainOf(
    facet: Wired,
    setup: SetupContext<object>,
    state: ChainState,
): Record<string, unknown> {
    const here = (): string => state.testDir ?? facet.locate();
    const setups = facet.capabilities.filter(
        (capability): capability is AnyCapability => capability.kind === 'setup',
    );
    const chain: Record<string, unknown> = {};
    for (const capability of facet.capabilities) {
        chain[capability.name] =
            capability.kind === 'context'
                ? (context: Partial<Record<ContextKey, unknown>>) =>
                      chainOf(facet, setup, withSharedSettings(setups, state, context, setup))
                : (...args: unknown[]) =>
                      chainOf(facet, setup, {
                          ...applied(state, capability, args, setup),
                          testDir: here(),
                      });
    }
    for (const action of facet.actions) {
        chain[action.name] = async (...args: unknown[]) =>
            await perform(setups, action, args, {
                config: setup.config,
                adapters: setup.adapters,
                state,
                testDir: here(),
            });
    }
    return chain;
}

export function defineFacet<Self, Config extends ChainConfig = ChainConfig>(): FacetDefiner<
    Self,
    Config
> {
    return (facet) => ({
        composition: facet,
        open: (config) =>
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the one cast: the chain is assembled from the definitions at run time, and its type computed from the same definitions at compile time
            chainOf(facet, { config, adapters: facet.adapters(config) }, EMPTY_STATE) as Self,
    });
}
