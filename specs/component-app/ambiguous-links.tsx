/**
 * Two links whose names OVERLAP — what CONVENTIONS W3 refuses to guess between,
 * and the one ambiguity `{ exact: true }` answers on its own: a name matches as
 * a case-insensitive substring unless the descriptor says otherwise.
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
        </div>
    );
}
