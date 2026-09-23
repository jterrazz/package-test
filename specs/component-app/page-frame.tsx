/**
 * A page's frame — the landmarks a layout component carries: a header, a
 * sidebar, a named form, a search region and a footer. The header and the
 * footer state their roles: a component is mounted inside the test page's
 * `<main>`, where an implicit banner or contentinfo is no landmark at all.
 */
export function PageFrame() {
    return (
        <>
            <header role="banner">
                <h1>Frame</h1>
            </header>
            <aside aria-label="Related">
                <a href="/related">Related post</a>
            </aside>
            <form aria-label="Newsletter">
                <label htmlFor="frame-email">Email</label>
                <input id="frame-email" type="email" />
            </form>
            <div role="search">
                <label htmlFor="frame-query">Query</label>
                <input id="frame-query" type="search" />
            </div>
            <footer role="contentinfo">
                <p>Frame footer</p>
            </footer>
        </>
    );
}
