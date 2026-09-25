/** A component reading the timezone the PROJECT gives every page's browser context. */
export function ZoneNote() {
    const { timeZone } = new Intl.DateTimeFormat().resolvedOptions();
    return (
        <dl>
            <dt>Zone</dt>
            <dd>{timeZone}</dd>
        </dl>
    );
}
