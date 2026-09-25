import type { ActionOption, ChainSignature, MatrixRow, Run } from './capability.js';
import type { ChainConfig } from './config.js';

export type SliceReader = <Slice>(capability: {
    readonly initial: Slice;
    readonly name: string;
}) => Slice;

export type Action<
    Name extends string,
    Args extends readonly unknown[],
    Result,
    Signature extends ChainSignature = ChainSignature,
    Needs extends object = Record<never, never>,
    Config extends ChainConfig = ChainConfig,
> = {
    readonly accessors: readonly MatrixRow[];
    readonly descriptors?: readonly MatrixRow[];
    readonly kind: 'action';
    readonly name: Name;
    readonly options?: readonly ActionOption<string>[];
    readonly row: MatrixRow;
    /** A type alone, never set at runtime: `ChainOf` reads it. */
    readonly signature?: Signature;
    readonly verbs?: readonly MatrixRow[];
    // oxlint-disable-next-line typescript/method-signature-style -- a method, so a definition of any arguments, result and engines is an `AnyAction`: a method's parameters compare bivariantly, a property's would pin each definition to its own types
    prepare?(
        args: Args,
        read: SliceReader,
    ): Promise<{ readonly workDir: null | string }> | { readonly workDir: null | string };
    // oxlint-disable-next-line typescript/method-signature-style -- a method, so a definition of any arguments, result and engines is an `AnyAction`: a method's parameters compare bivariantly, a property's would pin each definition to its own types
    perform(args: Args, read: SliceReader, engines: Needs, run: Run<Config>): Promise<Result>;
};

export type AnyAction = Action<string, readonly unknown[], unknown, ChainSignature, object>;

export function defineAction<
    const Name extends string,
    const Args extends readonly unknown[],
    Result,
    Signature extends ChainSignature = ChainSignature,
    Needs extends object = Record<never, never>,
    Config extends ChainConfig = ChainConfig,
>(
    definition: Omit<Action<Name, Args, Result, Signature, Needs, Config>, 'kind'>,
): Action<Name, Args, Result, Signature, Needs, Config> {
    return { ...definition, kind: 'action' };
}
