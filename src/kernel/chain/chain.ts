import type { ChainContext } from '../context/with.capability.js';
import type { Capability, ChainSignature, FacetParams, Intersect } from './capability.js';
import type { Composition } from './define-facet.js';

/** The names a list of definitions puts on the chain. */
type Names<List extends readonly { readonly name: string }[]> = List[number]['name'];

/**
 * The `with()` keys of the contextual setups a composition lists, read off
 * each setup's own type parameter: an optional `context` read by its shape
 * would infer as every key wherever it is absent, under a consumer's options
 * (no `exactOptionalPropertyTypes`) though not under this package's.
 */
type ContextOf<C extends Composition> = C['capabilities'][number] extends infer Member
    ? Member extends Capability<
          string,
          infer _Slice,
          infer _Args,
          infer _Signature,
          infer _Needs,
          infer Key
      >
        ? Key
        : never
    : never;

/** `with()`, when the composition lists it: exactly the settings of the setups it composes. */
type SharingOf<C extends Composition, Self> =
    'with' extends Names<C['capabilities']>
        ? {
              /**
               * The facet with what a whole file shares, each setting one of
               * the setups this facet composes — every chain it starts
               * beginning with those settings.
               */
              with: (context: Pick<ChainContext, ContextOf<C>>) => Self;
          }
        : unknown;

/** The methods one definition puts on a chain, its signature filled in with the chain and the params. */
type MethodsOf<Member, P extends FacetParams, Self> = Member extends {
    readonly signature?: infer Signature;
}
    ? Signature extends ChainSignature
        ? (Signature & { readonly params: P; readonly self: Self })['chain']
        : never
    : never;

/** Every method the composition's definitions put on a chain. */
type Methods<C extends Composition, P extends FacetParams, Self> = Intersect<
    MethodsOf<C['actions'][number] | C['capabilities'][number], P, Self>
>;

/**
 * A facet's chain type, computed from its composition: each definition's own
 * signature, filled in with the chain and the facet's parameters, and `with()`
 * over the settings it can share — no member the composition does not list.
 */
export type ChainOf<C extends Composition, P extends FacetParams, Self> = Pick<
    Methods<C, P, Self>,
    Extract<Names<C['actions']> | Names<C['capabilities']>, keyof Methods<C, P, Self>>
> &
    SharingOf<C, Self>;
