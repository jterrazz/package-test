import type { ActionOption, MatrixRow, Run } from './capability.js';

/** Read a setup's slice by its definition — the one way an action sees what the chain was told. */
export type SliceReader = <Slice>(capability: {
    readonly initial: Slice;
    readonly name: string;
}) => Slice;

/**
 * A terminal action a chain ends on, defined once for every facet that
 * composes it. `Needs` names the engines it performs through, by port key.
 */
export type Action<
    Name extends string,
    Args extends readonly unknown[],
    Result,
    Needs extends object = Record<never, never>,
> = {
    /** The rows of the result it hands back. */
    readonly accessors: readonly MatrixRow[];
    readonly kind: 'action';
    readonly name: Name;
    /** The arguments it takes beside its subject, each the matrix row it states. */
    readonly options?: readonly ActionOption<string>[];
    readonly row: MatrixRow;
    /**
     * What the action owes before any setup is armed: its refusals, what an
     * earlier action left standing taken down, and the directory it runs in.
     */
    // oxlint-disable-next-line typescript/method-signature-style -- a method, so a definition of any arguments, result and engines is an `AnyAction`: a method's parameters compare bivariantly, a property's would pin each definition to its own types
    prepare?(
        args: Args,
        read: SliceReader,
    ): Promise<{ readonly workDir: null | string }> | { readonly workDir: null | string };
    // oxlint-disable-next-line typescript/method-signature-style -- a method, so a definition of any arguments, result and engines is an `AnyAction`: a method's parameters compare bivariantly, a property's would pin each definition to its own types
    perform(args: Args, read: SliceReader, engines: Needs, run: Run): Promise<Result>;
};

/** Any action, whatever it takes and hands back — what a composition lists. */
export type AnyAction = Action<string, readonly unknown[], unknown, object>;

/** Define a terminal action; the definition is its own runtime value. */
export function defineAction<
    const Name extends string,
    const Args extends readonly unknown[],
    Result,
    Needs extends object = Record<never, never>,
>(definition: Omit<Action<Name, Args, Result, Needs>, 'kind'>): Action<Name, Args, Result, Needs> {
    return { ...definition, kind: 'action' };
}
