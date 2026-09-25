/** The names overlap: `link('Articles')` matches the whole name and does not reach "Articles archive". */
export function AmbiguousLinks() {
    return (
        <div>
            <nav aria-label="Primary">
                <a href="/articles">Articles</a>
            </nav>
            <section aria-label="Body">
                <a href="/articles/archive">Articles archive</a>
            </section>
            <aside aria-label="Aside">
                <a href="/articles/latest">Articles</a>
            </aside>
        </div>
    );
}
