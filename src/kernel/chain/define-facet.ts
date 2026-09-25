import type { Action, AnyAction } from './action.js';
import type {
    AnyCapability,
    Capability,
    ContextKey,
    MatrixRow,
    SetupContext,
    Sharing,
} from './capability.js';
import type { ChainConfig } from './config.js';
import { perform } from './perform.js';
import { applied, EMPTY_STATE } from './state.js';
import type { ChainState } from './state.js';

/** What a facet is made of: the setups it offers, the actions it ends on, its constructor's options. */
export type Composition = {
    readonly actions: readonly AnyAction[];
    readonly capabilities: readonly (AnyCapability | Sharing)[];
    /** The options its constructor takes, each the matrix row it states. */
    readonly options: Readonly<Record<string, MatrixRow>>;
};

/** The engines one definition performs through, by port key. */
type NeedsOf<Member> =
    Member extends Capability<string, infer _Slice, infer _Args, infer Needs, infer _Context>
        ? Needs
        : Member extends Action<string, infer _Args, infer _Result, infer Needs>
          ? Needs
          : unknown;

/** A union of object types, as the one type that is all of them. */
type Intersect<Union> = (Union extends unknown ? (member: Union) => void : never) extends (
    all: infer All,
) => void
    ? All
    : never;

/** The engines a composition needs: one per port key its definitions name. */
type EnginesOf<C extends Composition> = Intersect<
    NeedsOf<C['actions'][number] | C['capabilities'][number]>
>;

/** Every member a composition puts on its chain. */
type MemberNames<C extends Composition> =
    | C['actions'][number]['name']
    | C['capabilities'][number]['name'];

/** Nothing, when the chain type and the composition name the same members; else the difference, named. */
type SameMembers<Self, C extends Composition> = [keyof Self] extends [MemberNames<C>]
    ? [MemberNames<C>] extends [keyof Self]
        ? unknown
        : { readonly composedButNotOnTheChain: Exclude<MemberNames<C>, keyof Self> }
    : { readonly onTheChainButNotComposed: Exclude<keyof Self, MemberNames<C>> };

/** What a facet adds to its composition: the engines it arms, and where its paths start. */
type Wiring<C extends Composition, Config extends ChainConfig> = {
    /**
     * The adapters the constructor's configuration starts, one per port key —
     * its parameter typed as written: a parameter left to context makes the
     * whole facet context-sensitive, and the composition is then not inferred.
     */
    readonly engines: (config: Config) => EnginesOf<C> & object;
    /** The directory a chain's relative paths start from — the test file's, in node. */
    readonly locate: () => string;
};

/** A facet, ready to open a chain over the configuration its constructor built. */
type Facet<Self, Config extends ChainConfig> = {
    readonly composition: Composition;
    readonly open: (config: Config) => Self;
};

/** The definer `defineFacet<Self, Config>()` hands back. */
type FacetDefiner<Self, Config extends ChainConfig> = <const C extends Composition>(
    facet: C & SameMembers<Self, C> & Wiring<C, Config>,
) => Facet<Self, Config>;

/** A composition and where its paths start, as the chain reads them at run time. */
type Wired = Composition & Pick<Wiring<Composition, ChainConfig>, 'locate'>;

/** The one setup `with()` folds each contextual setup's value through. */
function shared(
    capabilities: Composition['capabilities'],
    state: ChainState,
    context: Partial<Record<ContextKey, unknown>>,
    setup: SetupContext<object>,
): ChainState {
    let next = state;
    for (const capability of capabilities) {
        const value =
            capability.kind === 'setup' && capability.context !== undefined
                ? context[capability.context]
                : undefined;
        if (capability.kind === 'setup' && value !== undefined) {
            next = applied(next, capability, [value], setup);
        }
    }
    return next;
}

/**
 * The chain over one state. Every setup hands back a NEW chain, and `with()`
 * leaves the directory unfixed, so a context written in a helper file never
 * anchors the paths of the test that uses it.
 */
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
                      chainOf(facet, setup, shared(facet.capabilities, state, context, setup))
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
                engines: setup.engines,
                state,
                testDir: here(),
            });
    }
    return chain;
}

/**
 * Define a facet by what it composes. `Self` is the chain type the facet
 * publishes, computed from the same composition; the compiler refuses a
 * composition that names other members than it. `Config` is the
 * configuration it opens over — `Started<…>` the engines its constructor
 * must start, so a facet opened without one does not compile.
 */
export function defineFacet<Self, Config extends ChainConfig = ChainConfig>(): FacetDefiner<
    Self,
    Config
> {
    return (facet) => ({
        composition: facet,
        open: (config) =>
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the one cast: the chain is assembled from the definitions at run time, and its type computed from the same definitions at compile time
            chainOf(facet, { config, engines: facet.engines(config) }, EMPTY_STATE) as Self,
    });
}
