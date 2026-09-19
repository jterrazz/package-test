/** Three links with one name — what CONVENTIONS W3 refuses to guess between. */
export function AmbiguousLinks() {
    return (
        <div>
            <nav aria-label="Primary">
                <a href="/articles">Articles</a>
            </nav>
            <section aria-label="Body">
                <a href="/articles">Articles</a>
            </section>
        </div>
    );
}
