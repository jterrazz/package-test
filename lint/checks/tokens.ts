import { TOKEN_KINDS } from '../../src/expectations/tokens/match.js';

export const VALID_TOKEN = /^[A-Za-z][A-Za-z0-9]*(?:#[\w.-]+)?$/u;
const BRACE_BLOCK = /\{\{(?<inner>[^{}]*)\}\}/gu;
export const LEADING_WORD = /^(?<kind>[A-Za-z][A-Za-z0-9]*)/u;

/** Oxlint visits only JS/TS sources, and the `no-unknown-token` grammar also binds the data fixtures; `TOKEN_KINDS` is shared with the runtime matcher so the channels cannot drift. */
const KNOWN = new Set<string>(TOKEN_KINDS);

/** Template noise (`{{.Server.Version}}`, `{{ spaced }}`, `{{123}}`) is out of the grammar and ignored. */
export function findUnknownTokens(text: string): { line: number; token: string }[] {
    const violations: { line: number; token: string }[] = [];
    const lines = text.split('\n');
    for (const [index, lineText] of lines.entries()) {
        for (const match of lineText.matchAll(BRACE_BLOCK)) {
            const inner = match.groups?.inner ?? '';
            if (VALID_TOKEN.test(inner)) {
                if (!KNOWN.has(inner.split('#')[0] ?? '')) {
                    violations.push({ line: index + 1, token: match[0] });
                }
                continue;
            }
            // Flagged only when a known kind is followed by junk, never arbitrary noise.
            const kind = LEADING_WORD.exec(inner)?.groups?.kind;
            if (kind !== undefined && KNOWN.has(kind) && inner !== kind) {
                violations.push({ line: index + 1, token: match[0] });
            }
        }
    }
    return violations;
}

export function findKnownTokens(text: string): { line: number; token: string }[] {
    const found: { line: number; token: string }[] = [];
    const lines = text.split('\n');
    for (const [index, lineText] of lines.entries()) {
        for (const match of lineText.matchAll(BRACE_BLOCK)) {
            const inner = match.groups?.inner ?? '';
            if (VALID_TOKEN.test(inner) && KNOWN.has(inner.split('#')[0] ?? '')) {
                found.push({ line: index + 1, token: match[0] });
            }
        }
    }
    return found;
}
