import type {
    BrowserLinkElement,
    BrowserMetaElement,
    BrowserPage,
} from '../../ports/browser.port.js';
import type { SpecificationConfig } from '../shared/builder.js';
import { JsonAccessor } from '../shared/result/json.js';
import { BaseResult } from '../shared/result/result.js';
import { TextAccessor } from '../shared/result/text.js';

/** A raw HTTP exchange captured by `.fetch()` — redirects are NOT followed. */
export interface FetchExchange {
    body: string;
    headers: Record<string, string>;
    status: number;
}

/** Result from a raw `.fetch()` action (robots.txt, sitemaps, redirects). */
export class FetchResult extends BaseResult {
    private readonly exchange: FetchExchange;

    constructor(options: {
        config: SpecificationConfig;
        exchange: FetchExchange;
        testDir: string;
    }) {
        super(options);
        this.exchange = options.exchange;
    }

    /** The response body as a text accessor (`toMatch('robots.txt')`, `.grep()`). */
    get body(): TextAccessor {
        return new TextAccessor(this.exchange.body, 'body', this.testDir, {
            captures: this.captures,
        });
    }

    /** Response headers as a flat, lower-cased key-value map. */
    get headers(): Record<string, string> {
        return this.exchange.headers;
    }

    /** The response body parsed as JSON. */
    get json(): JsonAccessor {
        return new JsonAccessor(this.exchange.body, this.testDir, undefined, this.captures);
    }

    /** The `location` header of a redirect response, or undefined. */
    get location(): string | undefined {
        return this.exchange.headers['location'];
    }

    /** The HTTP response status code — redirects surface as 3xx, never followed. */
    get status(): number {
        return this.exchange.status;
    }
}

/**
 * The head summary snapshotted by `expect(result.head).toMatch('home.head.json')`
 * — the stable, assertion-friendly projection of the document head.
 */
interface HeadSummary {
    alternates: Record<string, string>;
    canonical: null | string;
    metas: Record<string, string>;
    title: string;
}

/** Result from a rendered `.visit()` action — the page as a browser saw it. */
export class PageResult extends BaseResult {
    private readonly page: BrowserPage;

    constructor(options: { config: SpecificationConfig; page: BrowserPage; testDir: string }) {
        super(options);
        this.page = options.page;
    }

    /** Hreflang alternates declared in the head, keyed by language code. */
    get alternates(): Record<string, string> {
        const alternates: Record<string, string> = {};
        for (const link of this.page.links) {
            if (link.rel === 'alternate' && link.hreflang) {
                alternates[link.hreflang] = link.href;
            }
        }
        return alternates;
    }

    /** The canonical URL declared in the head, or null. */
    get canonical(): null | string {
        return this.page.links.find((link) => link.rel === 'canonical')?.href ?? null;
    }

    /**
     * The browser console as a stream — one message per line, prefixed by
     * its type — same shape as `stdout` on a cli result. Assert emptiness
     * with `toBeEmpty()`, or snapshot with `toMatch('home.console.txt')`.
     */
    get console(): TextAccessor {
        const lines = this.page.consoleMessages.map((m) => `[${m.type}] ${m.text}`).join('\n');
        return new TextAccessor(lines, 'console', this.testDir, { captures: this.captures });
    }

    /**
     * Console messages of type `error` only — the stream you usually want
     * empty: `expect(result.errors).toBeEmpty()`. Same shape as `stderr` on
     * a cli result.
     */
    get errors(): TextAccessor {
        const lines = this.page.consoleMessages
            .filter((m) => m.type === 'error')
            .map((m) => m.text)
            .join('\n');
        return new TextAccessor(lines, 'errors', this.testDir, { captures: this.captures });
    }

    /**
     * The document-head projection as a JSON accessor — title, canonical,
     * hreflang alternates, and named metas — for one golden per page:
     * `expect(result.head).toMatch('home.head.json')`.
     */
    get head(): JsonAccessor {
        const summary: HeadSummary = {
            alternates: this.alternates,
            canonical: this.canonical,
            metas: namedMetas(this.page.metas),
            title: this.page.title,
        };
        return new JsonAccessor(JSON.stringify(summary), this.testDir, undefined, this.captures);
    }

    /** The rendered DOM serialization as a text accessor. */
    get html(): TextAccessor {
        return new TextAccessor(this.page.html, 'html', this.testDir, {
            captures: this.captures,
        });
    }

    /**
     * Every `application/ld+json` block of the page, parsed, as one JSON
     * array — `expect(result.jsonLd).toMatch('article.jsonld.json')`.
     */
    get jsonLd(): JsonAccessor {
        const combined = `[${this.page.jsonLdBlocks.join(',')}]`;
        return new JsonAccessor(combined, this.testDir, undefined, this.captures);
    }

    /** `<link>` elements of the head, in DOM order. */
    get links(): BrowserLinkElement[] {
        return this.page.links;
    }

    /** The content of a named meta — `meta('description')`, `meta('og:image')`. */
    meta(name: string): string | undefined {
        return this.page.metas.find((m) => m.name === name || m.property === name)?.content;
    }

    /** HTTP status of the main document response. */
    get status(): number {
        return this.page.status;
    }

    /** Rendered body text as a text accessor. */
    get content(): TextAccessor {
        return new TextAccessor(this.page.text, 'text', this.testDir, {
            captures: this.captures,
        });
    }

    /** The document title as a text accessor. */
    get title(): TextAccessor {
        return new TextAccessor(this.page.title, 'title', this.testDir, {
            captures: this.captures,
        });
    }

    /** Final URL after redirects. */
    get url(): string {
        return this.page.url;
    }
}

/** Collapse meta elements into a flat name → content map (property wins the key). */
function namedMetas(metas: BrowserMetaElement[]): Record<string, string> {
    const named: Record<string, string> = {};
    for (const meta of metas) {
        const key = meta.name ?? meta.property;
        if (key) {
            named[key] = meta.content;
        }
    }
    return named;
}
