import type { SpecificationConfig } from './config.js';

/** The sections of the capability matrix a definition can state a row in. */
type MatrixGroup =
    | 'Constructor option'
    | 'Descriptor'
    | 'Result accessor'
    | 'Route option'
    | 'Setup'
    | 'Terminal action'
    | 'Verb';

/**
 * The capability-matrix row a definition states about itself: `name` as a spec
 * writes it, and `probe`, what a test exercising it writes — a call read in
 * `lint/matrix-calls.ts`'s grammar, or a literal.
 */
export type MatrixRow = {
    readonly group: MatrixGroup;
    /** The key of the chain or result this row answers for, when `name` spells it differently. */
    readonly member?: string;
    readonly name: string;
    readonly probe: string;
};

/** The settings a file may share through `with({ … })`: `ChainContext`'s keys. */
export type ContextKey = 'clock' | 'env' | 'headers';

/** The type parameters of a facet every signature may read. */
export type FacetParams = {
    readonly databaseKey: string;
    readonly services: Record<string, unknown>;
};

/** What an armed effect leaves behind until the action settles. */
export type Armed = {
    /** Undo the effect. Released in reverse arm order; an engine may defer the undo to the test's end. */
    readonly release?: () => void;
    /** The strict failure the engine recorded — preferred over the action's own error. */
    readonly violation?: () => Error | null;
};

/** Where one terminal action runs. */
export type Run = {
    readonly config: SpecificationConfig;
    /** The directory the chain's relative paths start from. */
    readonly testDir: string;
    /** The scratch directory a command runs in; `null` for an action that runs none. */
    readonly workDir: null | string;
};

/** What a setup is handed beside its arguments. */
export type SetupContext<Needs> = {
    readonly config: SpecificationConfig;
    readonly engines: Needs;
};

/**
 * A setup a chain offers, defined once for every facet that composes it.
 *
 * `Needs` names the engines it is armed through, by port key
 * (`{ network: InterceptPort }`); the facet hands them in, so a definition knows
 * its port and never an adapter. `Context` is the `with()` key a file states it
 * by, for the three settings a file may share.
 */
export type Capability<
    Name extends string,
    Slice,
    Args extends readonly unknown[],
    Needs extends object = Record<never, never>,
    Context extends ContextKey = never,
> = {
    /** The `with()` key this setup answers to. */
    readonly context?: Context;
    readonly initial: Slice;
    readonly kind: 'setup';
    readonly name: Name;
    /** Arm order across the setups of a chain: seed 10, fixture 20, viewport 30, intercept 40, clock 50. */
    readonly phase: number;
    readonly row: MatrixRow;
    /**
     * The effect before the action, through the engines alone. Absent when an
     * action reads the slice instead.
     */
    // oxlint-disable-next-line typescript/method-signature-style -- a method, so a definition of any slice, arguments and engines is an `AnyCapability`: a method's parameters compare bivariantly, a property's would pin each definition to its own types
    arm?(slice: Slice, engines: Needs, run: Run): Armed | Promise<Armed | undefined> | undefined;
    /** Validate the arguments and fold them into the slice, throwing the setup's refusal. */
    // oxlint-disable-next-line typescript/method-signature-style -- a method, so a definition of any slice, arguments and engines is an `AnyCapability`: a method's parameters compare bivariantly, a property's would pin each definition to its own types
    reduce(slice: Slice, args: Args, setup: SetupContext<Needs>): Slice;
};

/** Any setup, whatever it holds — what a composition lists. */
export type AnyCapability = Capability<string, unknown, readonly unknown[], object, ContextKey>;

/** `with()` — the one setup whose effect is the others': the contextual setups a file shares. */
export type Sharing = { readonly kind: 'context'; readonly name: 'with'; readonly row: MatrixRow };

/** Define a setup; the definition is its own runtime value. */
export function defineCapability<
    const Name extends string,
    Slice,
    const Args extends readonly unknown[],
    Needs extends object = Record<never, never>,
    const Context extends ContextKey = never,
>(
    definition: Omit<Capability<Name, Slice, Args, Needs, Context>, 'kind'>,
): Capability<Name, Slice, Args, Needs, Context> {
    return { ...definition, kind: 'setup' };
}
