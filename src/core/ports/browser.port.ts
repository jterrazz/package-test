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

/** The interactive//textual element kinds — what a visitor actually acts on. */
export type ElementKind = 'button' | 'field' | 'heading' | 'link' | 'testId' | 'text';

/**
 * A user-facing element descriptor — pure data, built by the element
 * vocabulary (`button()`, `link()`, `field()`, …) and translated into
 * concrete locators by the browser integration. CSS/XPath selectors are
 * deliberately not expressible: user-facing elements are the only surface.
 *
 * A descriptor must designate exactly ONE element at action time; see
 * {@link ElementMatch} and CONVENTIONS W3.
 */
export interface ElementRef {
    /**
     * Match the accessible name as a whole string rather than a substring.
     * Default (`false`) mirrors playwright: `link('Articles')` also matches
     * "Read Articles".
     */
    exact?: boolean;
    kind: ElementKind | LandmarkKind;
    /** Landmarks may be anonymous (`main()`, `banner()`); everything else is named. */
    name?: string;
    /**
     * Restrict the search to the elements of another descriptor — built by
     * `within(scope, target)`. Chains: a scope may itself carry a scope.
     */
    scope?: ElementRef;
}

/**
 * One candidate captured when a descriptor matched more than one element —
 * the evidence the ambiguity error enumerates so the author can disambiguate
 * without opening a browser.
 */
export interface ElementMatch {
    /** Nearest landmark ancestor (`nav`, `footer`, `main`…), when there is one. */
    context?: string;
    /** The attribute that disambiguates most — `href` for links, `name` for fields. */
    detail?: string;
    /** Tag name, lower-cased. */
    tag: string;
    /** Text content, whitespace-collapsed and truncated. */
    text: string;
}

/** A `<link>` element captured from the rendered document's head. */
export interface BrowserLinkElement {
    href: string;
    hreflang?: string;
    rel: string;
    type?: string;
}

/** A `<meta>` element captured from the rendered document's head. */
export interface BrowserMetaElement {
    content: string;
    name?: string;
    property?: string;
}

/** A console message emitted while the page loaded or the scenario ran. */
export interface BrowserConsoleMessage {
    text: string;
    type: string;
}

/**
 * The visitor — the interaction vocabulary handed to a visit scenario.
 * Every action auto-waits (playwright actionability); `see()` is the single
 * synchronization primitive: it retries until the element is visible and
 * fails at the timeout. There is no sleep and no conditional helper.
 */
export interface Visitor {
    /** Check a checkbox or radio. */
    check: (element: ElementRef) => Promise<void>;
    /** Click the element. */
    click: (element: ElementRef) => Promise<void>;
    /** Fill a form field with a value. */
    fill: (element: ElementRef, value: string) => Promise<void>;
    /** Navigate to a path of the site under test. */
    goto: (path: string) => Promise<void>;
    /** Hover the element. */
    hover: (element: ElementRef) => Promise<void>;
    /** Press a key (e.g. `Enter`). */
    press: (key: string) => Promise<void>;
    /** Wait until the element is visible — the only synchronization primitive. */
    see: (element: ElementRef) => Promise<void>;
    /** Select an option in a select field. */
    select: (element: ElementRef, option: string) => Promise<void>;
}

/** The behavior of a visit — the When of the spec; assertions stay in the Then. */
export type VisitScenario = (visitor: Visitor) => Promise<void>;

/** Per-visit options forwarded to the browser context. */
export interface BrowserOpenOptions {
    /**
     * Extra origins the `external: 'block'` policy lets through — the
     * declared stub backend the page legitimately fetches from.
     */
    allowedOrigins?: string[];
    /**
     * Base URL of the site under test — the origin `goto()` resolves against
     * and the boundary of the `external` policy.
     */
    baseUrl: string;
    /**
     * Cross-origin request policy. `'block'` aborts every request leaving
     * the site under test (analytics, CDNs) — the browser-side analog of
     * strict intercepts. `'allow'` lets them through (deployed-site mode).
     */
    external: 'allow' | 'block';
    /** Extra HTTP headers sent with every request of the visit (incl. User-Agent overrides). */
    headers?: Record<string, string>;
    /** The interaction scenario to run after load; the capture reflects the final state. */
    scenario?: VisitScenario;
}

/**
 * The rendered page captured by a browser visit — the FINAL state when a
 * scenario ran. Extraction happens in-page (the browser IS the HTML
 * parser); interpretation of the raw elements belongs to core.
 */
export interface BrowserPage {
    /** Console messages emitted while loading and interacting, in order. */
    consoleMessages: BrowserConsoleMessage[];
    /** Serialized DOM after rendering (`document.documentElement.outerHTML`). */
    html: string;
    /** Raw text content of every `application/ld+json` script, in DOM order. */
    jsonLdBlocks: string[];
    /** `<link>` elements of the head, in DOM order. */
    links: BrowserLinkElement[];
    /** `<meta>` elements of the head, in DOM order. */
    metas: BrowserMetaElement[];
    /** HTTP status of the main document response (0 when unavailable). */
    status: number;
    /** Rendered `document.body.innerText`. */
    text: string;
    /** `document.title` after rendering. */
    title: string;
    /** Final URL after redirects and scenario navigation. */
    url: string;
}

/**
 * Abstract browser interface for the website specification runner.
 * One implementation lives in `integrations/playwright/` — a single shared
 * browser instance per runner; each `open()` gets a fresh, isolated context.
 */
export interface BrowserPort {
    /** Close the shared browser instance (idempotent). */
    close: () => Promise<void>;
    /** Load `url` in a fresh context, run the scenario, capture the final page. */
    open: (url: string, options: BrowserOpenOptions) => Promise<BrowserPage>;
}
