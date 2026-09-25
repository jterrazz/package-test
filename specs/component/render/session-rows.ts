/** One row of the session list, as the extension's vanilla renderer knows it. */
export type SessionRow = { label: string; tone: 'idle' | 'live' };

/**
 * Fill a container with the session list — no React anywhere. Returns its own
 * teardown, the way a DOM library states one.
 */
export function renderSessionRows(container: HTMLElement, rows: SessionRow[]): () => void {
    const list = document.createElement('ul');
    list.setAttribute('aria-label', 'Sessions');
    for (const row of rows) {
        const item = document.createElement('li');
        item.className = `row row--${row.tone}`;
        item.textContent = row.label;
        list.append(item);
    }
    container.append(list);
    return () => {
        list.remove();
    };
}
