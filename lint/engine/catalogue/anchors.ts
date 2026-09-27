export function slugOf(heading: string): string {
    return heading
        .trim()
        .toLowerCase()
        .replaceAll(/[^\s\w-]/gu, '')
        .replaceAll(/\s/gu, '-');
}

export function anchorsOf(text: string): Set<string> {
    const found = new Set<string>();
    for (const line of text.split('\n')) {
        const heading = /^#{1,6}\s+(?<title>.+?)\s*$/u.exec(line)?.groups?.title;
        if (heading !== undefined) {
            found.add(slugOf(heading));
        }
        for (const rowAnchor of line.matchAll(/<a id="(?<id>[^"]+)"><\/a>/gu)) {
            found.add(rowAnchor.groups?.id ?? '');
        }
    }
    return found;
}
