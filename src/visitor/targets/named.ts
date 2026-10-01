import type {
    NamedTargetFactory,
    OptionallyNamedTargetFactory,
    Target,
    TargetOptions,
} from './target.js';

const stated = (options?: TargetOptions): Pick<Target, 'exact'> =>
    options?.exact === undefined ? {} : { exact: options.exact };

export const named =
    (kind: Target['kind']): NamedTargetFactory =>
    (name, options) => ({ kind, name, ...stated(options) });

export const optionallyNamed =
    (kind: Target['kind']): OptionallyNamedTargetFactory =>
    (name, options) => ({ kind, ...(name === undefined ? {} : { name }), ...stated(options) });
