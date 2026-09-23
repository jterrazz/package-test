/**
 * A site search written with the HTML `<search>` element — the landmark
 * carried by the element itself, with no `role` attribute to spell it — and
 * a "Go" button inside it and outside it.
 */
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
