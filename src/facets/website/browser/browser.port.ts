import type { ElementRef } from '../../../elements/descriptor.js';

/** A `<link>` element captured from the rendered document's head. */
export type BrowserLinkElement = {
    href: string;
    hreflang?: string | undefined;
    rel: string;
    type?: string | undefined;
};

/** A `<meta>` element captured from the rendered document's head. */
export type BrowserMetaElement = {
    content: string;
    name?: string | undefined;
    property?: string | undefined;
};

/** A console message emitted while the page loaded or the scenario ran. */
export type BrowserConsoleMessage = {
    text: string;
    type: string;
};

/**
 * The visitor — the interaction vocabulary handed to a visit scenario.
 * Every action auto-waits (playwright actionability); `see()` is the single
 * synchronization primitive: it retries until the element is visible and
 * fails at the timeout. There is no sleep and no conditional helper.
 */
export type Visitor = {
    /** Check a checkbox or radio. */
    check: (element: ElementRef) => Promise<void>;
    /** Click the element. */
    click: (element: ElementRef) => Promise<void>;
    /** Fill a form field with a value. */
    fill: (element: ElementRef, value: string) => Promise<void>;
    /**
     * Wait until the element is GONE — hidden, or never in the document. The
     * absence primitive: `see()` cannot answer "the dialog closed", because an
     * element that never appears and one that disappeared read the same to it.
     */
    gone: (element: ElementRef) => Promise<void>;
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
};

/** The behavior of a visit — the When of the spec; assertions stay in the Then. */
export type VisitScenario = (visitor: Visitor) => Promise<void>;

/** Per-visit options forwarded to the browser context. */
export type BrowserOpenOptions = {
    /**
     * Extra origins the `external: 'block'` policy lets through — the
     * declared stub backend the page legitimately fetches from.
     */
    allowedOrigins?: string[] | undefined;
    /**
     * Base URL of the site under test — the origin `goto()` resolves against
     * and the boundary of the `external` policy.
     */
    baseUrl: string;
    /**
     * Pin the page's own `Date` at this instant before the first byte is
     * parsed — the calendar the site's scripts read. `.clock()` on the chain.
     */
    clock?: string | undefined;
    /**
     * Cross-origin request policy. `'block'` aborts every request leaving
     * the site under test (analytics, CDNs) — the browser-side analog of
     * strict intercepts. `'allow'` lets them through (deployed-site mode).
     */
    external: 'allow' | 'block';
    /** Extra HTTP headers sent with every request of the visit (incl. User-Agent overrides). */
    headers?: Record<string, string> | undefined;
    /** The interaction scenario to run after load; the capture reflects the final state. */
    scenario?: undefined | VisitScenario;
};

/**
 * The rendered page captured by a browser visit — the FINAL state when a
 * scenario ran. Extraction happens in-page (the browser IS the HTML
 * parser); interpretation of the raw elements is the page result's
 * (`visit/page.result.ts`).
 */
export type BrowserPage = {
    /** Console messages emitted while loading and interacting, and the uncaught exceptions as errors, in order. */
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
    /** The ARIA snapshot of the rendered `<body>` — the outline a golden pins. */
    tree: string;
    /** `document.title` after rendering. */
    title: string;
    /** Final URL after redirects and scenario navigation. */
    url: string;
};

/**
 * The browser the website facet visits a page through.
 * One implementation, `playwright.adapter.ts` beside this port — one browser per vitest
 * worker, shared by every runner the worker hosts; each `open()` gets a fresh,
 * isolated context.
 */
export type BrowserPort = {
    /** Release the runner's use of the browser (idempotent); the browser is the worker's. */
    close: () => Promise<void>;
    /** Load `url` in a fresh context, run the scenario, capture the final page. */
    open: (url: string, options: BrowserOpenOptions) => Promise<BrowserPage>;
};
