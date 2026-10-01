/** The ARIA landmark roles: the containers a refusal can offer by name as a scope. */
export type LandmarkKind =
    | 'banner'
    | 'complementary'
    | 'contentinfo'
    | 'form'
    | 'main'
    | 'navigation'
    | 'region'
    | 'search';

/** The element kinds a visitor acts on. */
export type ElementKind =
    | 'button'
    | 'dialog'
    | 'field'
    | 'heading'
    | 'link'
    | 'listitem'
    | 'option'
    | 'row'
    | 'status'
    | 'table'
    | 'testId'
    | 'text';

/** What a visitor acts on, named as its user sees it; it must designate exactly one element (`target-matches-one-element`). */
export type Target = {
    /** Match the accessible name whole; absent means the default, exact. */
    exact?: boolean;
    /** Assert focus rather than presence, built by `focused(target)`. */
    focused?: boolean;
    /** Accepting input or not, built by `disabled(x)` / `enabled(x)`. */
    disabled?: boolean;
    kind: ElementKind | LandmarkKind;
    /** Landmarks may be anonymous (`main()`, `banner()`); everything else is named. */
    name?: string;
    /** The chosen option or not, built by `selected(x)`; read from `:checked`. */
    selected?: boolean;
    /** The field's live value, built by `valued(field, value)`. */
    value?: string;
    /** Search inside another target, built by `within(scope, target)`. */
    scope?: Target;
};

/** Options accepted by every named target. */
export type TargetOptions = {
    /** Match the accessible name whole; `true` by default, `{ exact: false }` for a name with a variable part. */
    exact?: boolean;
};

export type NamedTarget = (name: string, options?: TargetOptions) => Target;

export type OptionallyNamedTarget = (name?: string, options?: TargetOptions) => Target;
