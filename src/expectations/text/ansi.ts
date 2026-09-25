// oxlint-disable-next-line no-control-regex -- the ANSI escape IS the control character: stripping it is the point
const ANSI_RE = /\u001B\[[0-9;]*m/gu;

/** Strip ANSI escape sequences from a string (CONVENTIONS D6): what a golden compares is the text, never its colour. */
export function stripAnsiCodes(value: string): string {
    return value.replace(ANSI_RE, '');
}
