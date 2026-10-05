import type { Capability, ChainSignature, Intersect, SpecificationParams } from './capability.js';
import type { ChainContext } from './context/with.capability.js';
import type { Composition } from './define-specification.js';

type Names<List extends readonly { readonly name: string }[]> = List[number]['name'];

/** Read off the type parameter: the optional `context` read by shape infers every key under a consumer's options (no `exactOptionalPropertyTypes`). */
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

type SharingOf<C extends Composition, Self> =
    'with' extends Names<C['capabilities']>
        ? {
              with: (context: Pick<ChainContext, ContextOf<C>>) => Self;
          }
        : unknown;

type MethodsOf<Member, P extends SpecificationParams, Self> = Member extends {
    readonly signature?: infer Signature;
}
    ? Signature extends ChainSignature
        ? (Signature & { readonly params: P; readonly self: Self })['chain']
        : never
    : never;

type Methods<C extends Composition, P extends SpecificationParams, Self> = Intersect<
    MethodsOf<C['actions'][number] | C['capabilities'][number], P, Self>
>;

export type ChainOf<C extends Composition, P extends SpecificationParams, Self> = Pick<
    Methods<C, P, Self>,
    Extract<Names<C['actions']> | Names<C['capabilities']>, keyof Methods<C, P, Self>>
> &
    SharingOf<C, Self>;
