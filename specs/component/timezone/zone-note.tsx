export function ZoneNote() {
    const { timeZone } = new Intl.DateTimeFormat().resolvedOptions();
    return (
        <dl>
            <dt>Zone</dt>
            <dd>{timeZone}</dd>
        </dl>
    );
}
