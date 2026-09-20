/**
 * Two links whose names OVERLAP — the shape CONVENTIONS W3 refuses to guess
 * between, and the shape the 16.0 exact default answers on its own: a name
 * designates the accessible name WHOLE, so `link('Articles')` no longer reaches
 * "Articles archive". `{ exact: false }` brings the old matching back.
 */
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
