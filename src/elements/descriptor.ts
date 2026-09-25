/** The ARIA landmark roles, the only containers a scope can name. */
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

/** A user-facing element descriptor; it must designate exactly one element (W3). */
export type ElementRef = {
    /** Match the accessible name whole; absent means the default, exact. */
    exact?: boolean;
    /** Assert focus rather than presence, built by `focused(element)`. */
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
    /** Search inside another descriptor, built by `within(scope, target)`. */
    scope?: ElementRef;
};

/** One candidate of an ambiguous descriptor, as the refusal lists it. */
export type ElementMatch = {
    /** The accessible name, when it differs from the text (an `aria-label`). */
    accessibleName?: string | undefined;
    /** Nearest landmark ancestor (`nav`, `footer`, `main`…), when there is one. */
    context?: string | undefined;
    /** That landmark's accessible name. */
    contextName?: string | undefined;
    /** The attribute that disambiguates most — `href` for links, `name` for fields. */
    detail?: string | undefined;
    /** Tag name, lower-cased. */
    tag: string;
    /** Text content, whitespace-collapsed and truncated. */
    text: string;
};
