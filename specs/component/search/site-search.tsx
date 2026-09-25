/** The `<search>` element carries the landmark with no `role` attribute; one "Go" button inside it, one outside. */
export function SiteSearch() {
    return (
        <>
            <search aria-label="Site">
                <label htmlFor="site-query">Query</label>
                <input id="site-query" type="search" />
                <button type="button">Go</button>
            </search>
            <main>
                <button type="button">Go</button>
            </main>
        </>
    );
}
