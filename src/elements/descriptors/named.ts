import type { ElementOptions, ElementRef } from './element.js';

export type NamedFactory = (name: string, options?: ElementOptions) => ElementRef;

export type OptionallyNamedFactory = (name?: string, options?: ElementOptions) => ElementRef;

const stated = (options?: ElementOptions): Pick<ElementRef, 'exact'> =>
    options?.exact === undefined ? {} : { exact: options.exact };

export const named =
    (kind: ElementRef['kind']): NamedFactory =>
    (name: string, options?: ElementOptions): ElementRef => ({ kind, name, ...stated(options) });

export const optionallyNamed =
    (kind: ElementRef['kind']): OptionallyNamedFactory =>
    (name?: string, options?: ElementOptions): ElementRef => ({
        kind,
        ...(name === undefined ? {} : { name }),
        ...stated(options),
    });
