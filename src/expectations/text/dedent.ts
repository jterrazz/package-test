/** A text opening on a line break loses that break, the closing line's whitespace and the shared indentation. */
export function dedent(text: string): string {
    if (!text.startsWith('\n')) {
        return text;
    }
    const lines = text.slice(1).split('\n');
    const last = lines.at(-1);
    if (last?.trim() === '') {
        lines[lines.length - 1] = '';
    }
    const indents = lines
        .filter((line) => line.trim() !== '')
        .map((line) => /^[\t ]*/u.exec(line)?.[0].length ?? 0);
    const common = indents.length === 0 ? 0 : Math.min(...indents);
    return lines.map((line) => (line.length < common ? '' : line.slice(common))).join('\n');
}
