import { BaseResult } from '../../../expectations/result.js';
import type { ResultConfig } from '../../../expectations/result.js';
import { consoleOf, errorsOf } from '../../../expectations/text/console.js';
import { JsonAccessor } from '../../../expectations/text/json.js';
import { TextAccessor } from '../../../expectations/text/text.js';
import type {
    BrowserLinkElement,
    BrowserMetaElement,
    BrowserPage,
} from '../browser/browser.port.js';

type HeadSummary = {
    alternates: Record<string, string>;
    canonical: null | string;
    metas: Record<string, string>;
    title: string;
};

/** Result from a rendered `.visit()` action: the page as a browser saw it. */
export class PageResult extends BaseResult {
    private readonly page: BrowserPage;

    constructor(options: { config: ResultConfig; page: BrowserPage; testDir: string }) {
        super(options);
        this.page = options.page;
    }

    /** Hreflang alternates declared in the head, keyed by language code. */
    get alternates(): Record<string, string> {
        const alternates: Record<string, string> = {};
        for (const link of this.page.links) {
            if (link.rel === 'alternate' && link.hreflang !== undefined && link.hreflang !== '') {
                alternates[link.hreflang] = link.href;
            }
        }
        return alternates;
    }

    /** The canonical URL declared in the head, or null. */
    get canonical(): null | string {
        return this.page.links.find((link) => link.rel === 'canonical')?.href ?? null;
    }

    /** The browser console as a stream, one `[type] message` per line. */
    get console(): TextAccessor {
        return new TextAccessor(consoleOf(this.page.consoleMessages), 'console', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** Console errors and uncaught exceptions, the stream usually expected empty. */
    get errors(): TextAccessor {
        return new TextAccessor(errorsOf(this.page.consoleMessages), 'errors', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** The head projection (title, canonical, alternates, named metas), one golden per page. */
    get head(): JsonAccessor {
        const summary: HeadSummary = {
            alternates: this.alternates,
            canonical: this.canonical,
            metas: namedMetas(this.page.metas),
            title: this.page.title,
        };
        return new JsonAccessor(JSON.stringify(summary), 'head', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** The rendered DOM serialization as a text accessor. */
    get html(): TextAccessor {
        return new TextAccessor(this.page.html, 'html', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** Every `application/ld+json` block, parsed, as one JSON array. */
    get jsonLd(): JsonAccessor {
        const combined = `[${this.page.jsonLdBlocks.join(',')}]`;
        return new JsonAccessor(combined, 'jsonLd', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** `<link>` elements of the head, in DOM order. */
    get links(): BrowserLinkElement[] {
        return this.page.links;
    }

    /** The content of a named meta: `meta('description')`, `meta('og:image')`. */
    meta(name: string): string | undefined {
        return this.page.metas.find((m) => m.name === name || m.property === name)?.content;
    }

    /** HTTP status of the main document response. */
    get status(): number {
        return this.page.status;
    }

    /** Rendered body text as a text accessor. */
    get content(): TextAccessor {
        return new TextAccessor(this.page.text, 'content', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** The ARIA snapshot of the rendered `<body>`, the same dialect a component spec asserts. */
    get tree(): TextAccessor {
        return new TextAccessor(this.page.tree, 'tree', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** The document title as a text accessor. */
    get title(): TextAccessor {
        return new TextAccessor(this.page.title, 'title', this.testDir, {
            captures: this.captures,
            transform: this.config.transform,
        });
    }

    /** Final URL after redirects. */
    get url(): string {
        return this.page.url;
    }
}

// invariant: property wins the key.
function namedMetas(metas: BrowserMetaElement[]): Record<string, string> {
    const named: Record<string, string> = {};
    for (const meta of metas) {
        const key = meta.name ?? meta.property;
        if (key !== undefined && key !== '') {
            named[key] = meta.content;
        }
    }
    return named;
}
