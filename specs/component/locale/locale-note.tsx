/** A component reading the locale the PROJECT gives every page's browser context. */
export function LocaleNote() {
    const { locale } = new Intl.DateTimeFormat().resolvedOptions();
    return (
        <dl>
            <dt>Locale</dt>
            <dd>{locale}</dd>
        </dl>
    );
}
