import { RenderedText } from './rendered-text.js';

/** What a render resolves to: the component as the page saw it after the scenario. */
export class RenderResult {
    /** The browser console as a stream: one `[type] text` line per message. */
    readonly console: RenderedText;
    /** Rendered text of the whole document body (`innerText`). */
    readonly content: RenderedText;
    /** Console messages of type `error` only, plus any uncaught page error. */
    readonly errors: RenderedText;
    /** The mounted markup, serialised: the escape hatch for a class or an attribute. */
    readonly html: RenderedText;
    /** The ARIA snapshot of the rendered body, the outline a golden pins. */
    readonly tree: RenderedText;
    /** Rendered text of the body without the text of an element drawn fully transparent: what a reader sees of an animation, where `content` keeps a node at `opacity: 0`. */
    readonly visibleContent: RenderedText;

    constructor(streams: {
        console: string;
        content: string;
        errors: string;
        html: string;
        tree: string;
        visibleContent: string;
    }) {
        // invariant: the golden commands resolve the test's directory server-side: a page-captured accessor carries none.
        this.console = new RenderedText(streams.console, 'console', '');
        this.content = new RenderedText(streams.content, 'content', '');
        this.errors = new RenderedText(streams.errors, 'errors', '');
        this.html = new RenderedText(streams.html, 'html', '');
        this.tree = new RenderedText(streams.tree, 'tree', '');
        this.visibleContent = new RenderedText(streams.visibleContent, 'visible-content', '');
    }
}
