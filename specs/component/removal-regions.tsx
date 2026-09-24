/**
 * Three "Remove" buttons, each in a `<section>`: one named by its label, one
 * by the heading it points at, one unnamed — which makes it no region at all.
 */
export function RemovalRegions() {
    return (
        <main>
            <section aria-label="Orders">
                <button type="button">Remove</button>
            </section>
            <section aria-labelledby="returns-title">
                <h2 id="returns-title">Returns</h2>
                <button type="button">Remove</button>
            </section>
            <section>
                <button type="button">Remove</button>
            </section>
        </main>
    );
}
