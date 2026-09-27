import { reportLine as compilerLine } from '@jterrazz/typescript/rules';
import type { Teaching } from '@jterrazz/typescript/rules';

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

export function reportLine(violation: Finding, message: string): string {
    return compilerLine(CHECKER_NAMESPACE, { ...violation, path: violation.file }, message);
}
