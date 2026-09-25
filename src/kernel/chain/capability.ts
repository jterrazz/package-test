import type { ChainContext } from '../context/with.capability.js';
import type { ChainConfig } from './config.js';

type MatrixGroup =
    | 'Constructor option'
    | 'Descriptor'
    | 'Result accessor'
    | 'Route option'
    | 'Setup'
    | 'Terminal action'
    | 'Verb';

/** `probe` is a call in `lint/matrix-calls.ts`'s grammar, or a literal. */
export type MatrixRow = {
    readonly group: MatrixGroup;
    readonly member?: string;
    readonly name: string;
    readonly probe: string;
};

export type ContextKey = keyof ChainContext;

export type Intersect<Union> = (Union extends unknown ? (member: Union) => void : never) extends (
    all: infer All,
) => void
    ? All
    : never;

export type FacetParams = {
    readonly databaseKey: string;
    readonly services: Record<string, unknown>;
};

/** Each definition extends this, naming its methods over `this['self']` and `this['params']`; `ChainOf` fills both in. */
// oxlint-disable-next-line typescript/consistent-type-definitions -- a signature is read through `this`, which only an interface can name: a facet fills `self` and `params` in by intersecting it
export interface ChainSignature {
    readonly chain: object;
    readonly params: FacetParams;
    readonly self: unknown;
}

export type Armed = {
    /** Released in reverse arm order; an engine may defer it to the test's end. */
    readonly release?: () => void;
    /** Preferred over the action's own error. */
    readonly violation?: () => Error | null;
};

export type Run<Config extends ChainConfig = ChainConfig> = {
    readonly config: Config;
    readonly testDir: string;
    readonly workDir: null | string;
};

export type SetupContext<Needs, Config extends ChainConfig = ChainConfig> = {
    readonly config: Config;
    readonly engines: Needs;
};

export type Capability<
    Name extends string,
    Slice,
    Args extends readonly unknown[],
    Signature extends ChainSignature = ChainSignature,
    Needs extends object = Record<never, never>,
    Context extends ContextKey = never,
    Config extends ChainConfig = ChainConfig,
> = {
    readonly context?: Context;
    readonly initial: Slice;
    readonly kind: 'setup';
    readonly name: Name;
    /** Arm order across the setups of a chain: seed 10, fixture 20, viewport 30, intercept 40, clock 50. */
    readonly phase: number;
    readonly row: MatrixRow;
    /** A type alone, never set at runtime: `ChainOf` reads it. */
    readonly signature?: Signature;
    /** Absent when the action reads the slice instead. */
    // oxlint-disable-next-line typescript/method-signature-style -- a method, so a definition of any slice, arguments and engines is an `AnyCapability`: a method's parameters compare bivariantly, a property's would pin each definition to its own types
    arm?(
        slice: Slice,
        engines: Needs,
        run: Run<Config>,
    ): Armed | Promise<Armed | undefined> | undefined;
    // oxlint-disable-next-line typescript/method-signature-style -- a method, so a definition of any slice, arguments and engines is an `AnyCapability`: a method's parameters compare bivariantly, a property's would pin each definition to its own types
    reduce(slice: Slice, args: Args, setup: SetupContext<Needs, Config>): Slice;
};

export type AnyCapability = Capability<
    string,
    unknown,
    readonly unknown[],
    ChainSignature,
    object,
    ContextKey
>;

export type ActionOption<Name extends string> = {
    readonly kind: 'option';
    readonly name: Name;
    readonly row: MatrixRow;
};

export type Sharing = { readonly kind: 'context'; readonly name: 'with'; readonly row: MatrixRow };

export function defineCapability<
    const Name extends string,
    Slice,
    const Args extends readonly unknown[],
    Signature extends ChainSignature = ChainSignature,
    Needs extends object = Record<never, never>,
    const Context extends ContextKey = never,
    Config extends ChainConfig = ChainConfig,
>(
    definition: Omit<Capability<Name, Slice, Args, Signature, Needs, Context, Config>, 'kind'>,
): Capability<Name, Slice, Args, Signature, Needs, Context, Config> {
    return { ...definition, kind: 'setup' };
}
