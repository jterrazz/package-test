type ConsoleLine = { readonly text: string; readonly type: string };

export function consoleOf(lines: readonly ConsoleLine[]): string {
    return lines.map((line) => `[${line.type}] ${line.text}`).join('\n');
}

export function errorsOf(lines: readonly ConsoleLine[]): string {
    return lines
        .filter((line) => line.type === 'error')
        .map((line) => line.text)
        .join('\n');
}
