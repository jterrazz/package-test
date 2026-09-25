import type { ActionSignatures } from '../actions/signatures.js';
import type { SetupSignatures } from '../capabilities/signatures.js';
import type { ChainContext } from '../capabilities/with/with.capability.js';
import type { ContextKey, FacetParams } from '../model/chain/capability.js';
import type { Composition } from './define-facet.js';

/** The names a list of definitions puts on the chain. */
type Names<List extends readonly { readonly name: string }[]> = List[number]['name'];

/** The `with()` keys of the contextual setups a composition lists. */
type ContextOf<C extends Composition> = C['capabilities'][number] extends infer Member
    ? Member extends { readonly context?: infer Key extends ContextKey }
        ? Key
        : never
    : never;

/** `with()`, when the composition lists it: exactly the settings of the setups it composes. */
type SharingOf<C extends Composition, Self> =
    'with' extends Names<C['capabilities']>
        ? {
              /**
               * The facet with what a whole file shares — `const events = api.with({ clock })` —
               * every chain it starts beginning with those settings.
               */
              with: (context: Pick<ChainContext, ContextOf<C>>) => Self;
          }
        : unknown;

/**
 * A facet's chain type, computed from its composition: each setup's signature,
 * each action's, and `with()` over the settings it can share — no member the
 * composition does not list.
 */
export type ChainOf<C extends Composition, P extends FacetParams, Self> = Pick<
    ActionSignatures<P>,
    Extract<Names<C['actions']>, keyof ActionSignatures<P>>
> &
    Pick<
        SetupSignatures<Self, P>,
        Extract<Names<C['capabilities']>, keyof SetupSignatures<Self, P>>
    > &
    SharingOf<C, Self>;
