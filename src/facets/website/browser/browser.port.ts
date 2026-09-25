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

/** The verbs a visit scenario is handed; every action auto-waits, `see()` is the one synchronization primitive. */
export type Visitor = {
    /** Check a checkbox or radio. */
    check: (element: ElementRef) => Promise<void>;
    click: (element: ElementRef) => Promise<void>;
    /** Fill a form field with a value. */
    fill: (element: ElementRef, value: string) => Promise<void>;
    /** Wait until the element is gone, hidden or never in the document. */
    gone: (element: ElementRef) => Promise<void>;
    /** Navigate to a path of the site under test. */
    goto: (path: string) => Promise<void>;
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
    /** Extra origins the `external: 'block'` policy lets through, such as the stub backend. */
    allowedOrigins?: string[] | undefined;
    /** Base URL of the site under test: what `goto()` resolves against. */
    baseUrl: string;
    /** Pin the page's `Date` before the first byte is parsed. */
    clock?: string | undefined;
    /** `'block'` aborts every request leaving the site under test; `'allow'` lets them through. */
    external: 'allow' | 'block';
    /** Extra HTTP headers sent with every request of the visit (incl. User-Agent overrides). */
    headers?: Record<string, string> | undefined;
    /** The interaction scenario to run after load; the capture reflects the final state. */
    scenario?: undefined | VisitScenario;
};

/** The rendered page a visit captured, final state. */
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

/** The browser the website facet visits through: one per worker, a fresh context per `open()`. */
export type BrowserPort = {
    /** Release the runner's use of the browser (idempotent); the browser is the worker's. */
    close: () => Promise<void>;
    /** Load `url` in a fresh context, run the scenario, capture the final page. */
    open: (url: string, options: BrowserOpenOptions) => Promise<BrowserPage>;
};
