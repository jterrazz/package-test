/**
 * A value written in place, read as the text it states.
 *
 * A test writes a multi-line expectation — a response, a stream, a seed — as a
 * template literal indented with the code around it. The indentation belongs to
 * the test, not to the value: a text that opens on a line break is read with
 * that line break dropped, the whitespace the closing backtick's line holds
 * dropped, and the indentation every non-empty line shares removed. A text
 * that does not open on a line break is the value exactly as written.
 *
 * @example
 *   dedent(`
 *       HTTP/1.1 200 OK
 *
 *       {"ok": true}
 *   `) // 'HTTP/1.1 200 OK\n\n{"ok": true}\n'
 */
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
