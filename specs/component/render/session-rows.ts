export type SessionRow = { label: string; tone: 'idle' | 'live' };

/** No React anywhere; it returns its own teardown, the way a DOM library states one. */
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
