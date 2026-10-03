function indentOf(line: string): number {
    // Stryker disable next-line OptionalChaining,Regex: the pattern matches at the start of any line, if emptily
    return /^[\t ]*/u.exec(line)?.[0].length ?? 0;
}

/** A text opening on a line break loses that break, the closing line's whitespace and the shared indentation. */
export function dedent(text: string): string {
    if (!text.startsWith('\n')) {
        return text;
    }
    const lines = text.slice(1).split('\n');
    const last = lines.at(-1);
    // Stryker disable next-line OptionalChaining: a split always has a last piece
    if (last?.trim() === '') {
        lines[lines.length - 1] = '';
    }
    const indents = lines.filter((line) => line.trim() !== '').map((line) => indentOf(line));
    const common = indents.length === 0 ? 0 : Math.min(...indents);
    return lines.map((line) => line.slice(common)).join('\n');
}
