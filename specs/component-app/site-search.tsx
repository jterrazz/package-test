/**
 * A site search written with the HTML `<search>` element — the landmark
 * carried by the element itself, with no `role` attribute to spell it.
 */
export function SiteSearch() {
    return (
        <search aria-label="Site">
            <label htmlFor="site-query">Query</label>
            <input id="site-query" type="search" />
        </search>
    );
}
