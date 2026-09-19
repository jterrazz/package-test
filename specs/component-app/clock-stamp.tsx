/** A component that reads the page's clock — the `.clock()` subject. */
export function ClockStamp() {
    return <p>Rendered at {new Date().toISOString()}</p>;
}
