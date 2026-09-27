import type { Teaching } from '../catalogue/lesson.js';

export const CHECKER_NAMESPACE = 'jterrazz-check';

export type Finding<PassId extends string = string> = Teaching & {
    /** A finding about a whole file or folder points at its first column. */
    column?: number;
    file: string;
    line: number;
    /** Published as `jterrazz-check(<name>)`, counted by the ratchet under `jterrazz-check/<name>`. */
    rule: PassId;
    token?: string;
};

/** The compiler convention every editor's problem matcher parses, and oxlint's findings normalise to. */
export function reportLine(violation: Finding, message: string): string {
    const { column, file, line, rule } = violation;
    return `${file}:${line}:${column ?? 1}: error ${CHECKER_NAMESPACE}(${rule}): ${message}`;
}
