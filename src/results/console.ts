/** One console message, as a page emitted it. */
type ConsoleLine = { readonly text: string; readonly type: string };

/**
 * The console as a stream — one `[type] text` line per message, the shape
 * `stdout` has on a cli result. A served page and a mounted component write
 * it alike.
 */
export function consoleOf(lines: readonly ConsoleLine[]): string {
    return lines.map((line) => `[${line.type}] ${line.text}`).join('\n');
}

/** The messages of type `error` alone, one per line — the shape `stderr` has on a cli result. */
export function errorsOf(lines: readonly ConsoleLine[]): string {
    return lines
        .filter((line) => line.type === 'error')
        .map((line) => line.text)
        .join('\n');
}
