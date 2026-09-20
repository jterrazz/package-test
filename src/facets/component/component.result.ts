import { RenderedText } from './rendered-text.js';

/**
 * What a render resolves to — the component as the page saw it, after the
 * scenario ran.
 *
 * Five accessors and no more: the ARIA outline a golden pins, the two
 * renderings a probe reads, and the two streams a spec wants silent. Nothing
 * here reaches back into React — a spec that needs the component's internals
 * is asserting the implementation, not the surface a user meets.
 */
export class RenderResult {
    /** The browser console as a stream — one `[type] text` line per message. */
    readonly console: RenderedText;
    /** Rendered text of the whole document body (`innerText`). */
    readonly content: RenderedText;
    /** Console messages of type `error` only, plus any uncaught page error. */
    readonly errors: RenderedText;
    /** The mounted markup, serialised — the escape hatch for a class or an attribute. */
    readonly html: RenderedText;
    /** The ARIA snapshot of the rendered body — the outline a golden pins. */
    readonly tree: RenderedText;

    constructor(streams: {
        console: string;
        content: string;
        errors: string;
        html: string;
        tree: string;
    }) {
        // The test's own directory is resolved SERVER-side by the golden
        // Commands (`context.testPath`), so a page-captured accessor carries no
        // Directory of its own — there is no disk here to resolve one against.
        this.console = new RenderedText(streams.console, 'console', '');
        this.content = new RenderedText(streams.content, 'content', '');
        this.errors = new RenderedText(streams.errors, 'errors', '');
        this.html = new RenderedText(streams.html, 'html', '');
        this.tree = new RenderedText(streams.tree, 'tree', '');
    }
}
