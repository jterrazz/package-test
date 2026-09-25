/**
 * The landmark roles — the standard set of page regions, and the only
 * containers a scope can name. Closed on purpose: ARIA defines exactly these,
 * so `within()` never becomes a second selector language.
 */
export type LandmarkKind =
    | 'banner'
    | 'complementary'
    | 'contentinfo'
    | 'form'
    | 'main'
    | 'navigation'
    | 'region'
    | 'search';

/**
 * The interactive/textual element kinds — what a visitor actually acts on.
 *
 * `dialog`, `status`, `table`, `row`, `listitem` and `option` are ARIA roles
 * like the landmarks, but they are not CONTAINERS of a page: they are things a
 * visitor reads and acts on, and they are the roles the estate's UI specs were
 * already reaching for through `getByRole` or, worse, through `.first()`.
 */
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

/**
 * A user-facing element descriptor — pure data, built by the element
 * vocabulary (`button()`, `link()`, `field()`, …) and translated into
 * concrete locators by the browser integration. CSS/XPath selectors are
 * deliberately not expressible: user-facing elements are the only surface.
 *
 * A descriptor must designate exactly ONE element at action time; see
 * {@link ElementMatch} and CONVENTIONS W3.
 */
export type ElementRef = {
    /**
     * Match the accessible name as a whole string rather than a substring.
     *
     * ABSENT means "the author said nothing", which the adapters read as the
     * default — exact.
     */
    exact?: boolean;
    /**
     * Assert about the element's FOCUS rather than its presence — built by
     * `focused(element)`. The accessibility tree carries no focus state, so
     * where the keyboard is cannot be goldened; it is asserted by a verb.
     */
    focused?: boolean;
    /**
     * Narrows to "and it is (not) accepting input" — built by `disabled(x)` /
     * `enabled(x)`. Like `focused`, a STATE the vocabulary can already name the
     * element of; unlike it, one the ARIA tree carries too (`[disabled]`), so
     * this modifier is what names the ONE control a test is about, and it
     * reaches the direction a behavioural substitute cannot — clicking a
     * disabled control is a timeout, never an answer.
     */
    disabled?: boolean;
    kind: ElementKind | LandmarkKind;
    /** Landmarks may be anonymous (`main()`, `banner()`); everything else is named. */
    name?: string;
    /**
     * Narrows to "and it is (not) the chosen one" — built by `selected(x)`.
     * An option of a COLLAPSED select is in the tree and in the document, and
     * it has no box on the screen, so this facet of it is read from the node
     * (`:checked`) rather than from what a visitor could point at.
     */
    selected?: boolean;
    /**
     * The value the field must hold — built by `valued(field('Title'), '…')`.
     * A field's value is a PROPERTY of the node: a controlled input's `value`
     * attribute never moves, so nothing but the live value answers for it.
     */
    value?: string;
    /**
     * Restrict the search to the elements of another descriptor — built by
     * `within(scope, target)`. Chains: a scope may itself carry a scope.
     */
    scope?: ElementRef;
};

/**
 * One candidate captured when a descriptor matched more than one element —
 * the evidence the ambiguity error enumerates so the author can disambiguate
 * without opening a browser.
 */
export type ElementMatch = {
    /**
     * The accessible name, when it differs from the text — an `aria-label` is
     * what a role descriptor MATCHED on, and printing the text alone sends the
     * author to disambiguate a name they cannot see.
     */
    accessibleName?: string | undefined;
    /** Nearest landmark ancestor (`nav`, `footer`, `main`…), when there is one. */
    context?: string | undefined;
    /**
     * That landmark's accessible name — its `aria-label`, or the text its
     * `aria-labelledby` points at. A `<section>` is a `region` only when it is
     * named, and several regions are the norm, so the name is what makes
     * `region("…")` a rewrite.
     */
    contextName?: string | undefined;
    /** The attribute that disambiguates most — `href` for links, `name` for fields. */
    detail?: string | undefined;
    /** Tag name, lower-cased. */
    tag: string;
    /** Text content, whitespace-collapsed and truncated. */
    text: string;
};
