/**
 * A component reading what the PROJECT gives every page: the timezone and
 * the locale of the browser context, the size of the page, and the instant
 * the page's clock is on.
 */
export function LocaleNote() {
    const { locale, timeZone } = new Intl.DateTimeFormat().resolvedOptions();
    return (
        <dl>
            <dt>Zone</dt>
            <dd>{timeZone}</dd>
            <dt>Locale</dt>
            <dd>{locale}</dd>
            <dt>Page</dt>
            <dd>{`${globalThis.innerWidth}×${globalThis.innerHeight}`}</dd>
            <dt>Now</dt>
            <dd>{new Date().toISOString()}</dd>
        </dl>
    );
}
