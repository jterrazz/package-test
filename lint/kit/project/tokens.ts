export const TOKEN_KINDS = [
    'any',
    'base64',
    'date',
    'duration',
    'email',
    'float',
    'hex',
    'int',
    'ip',
    'iso8601',
    'number',
    'path',
    'port',
    'semver',
    'sha',
    'string',
    'time',
    'ulid',
    'url',
    'uuid',
    'workdir',
] as const;

export type TokenKind = (typeof TOKEN_KINDS)[number];

const VALID_TOKEN = /^[A-Za-z][A-Za-z0-9]*(?:#[\w.-]+)?$/u;
const BRACE_BLOCK = /\{\{(?<inner>[^{}]*)\}\}/gu;
const LEADING_WORD = /^(?<kind>[A-Za-z][A-Za-z0-9]*)/u;

const KNOWN = new Set<string>(TOKEN_KINDS);

type TokenSite = { line: number; token: string };

/** Template noise (`{{.Server.Version}}`, `{{ spaced }}`, `{{123}}`) is out of the grammar and ignored. */
function misfitOf(inner: string): null | { malformed: boolean } {
    if (VALID_TOKEN.test(inner)) {
        return KNOWN.has(inner.split('#')[0] ?? '') ? null : { malformed: false };
    }
    // invariant: flagged only when a known kind is followed by junk, never arbitrary noise.
    const kind = LEADING_WORD.exec(inner)?.groups?.kind;
    return kind !== undefined && KNOWN.has(kind) && inner !== kind ? { malformed: true } : null;
}

function misfitTokens(text: string): (TokenSite & { malformed: boolean })[] {
    return text.split('\n').flatMap((lineText, index) =>
        [...lineText.matchAll(BRACE_BLOCK)].flatMap((match) => {
            const misfit = misfitOf(match.groups?.inner ?? '');
            return misfit === null ? [] : [{ line: index + 1, ...misfit, token: match[0] }];
        }),
    );
}

export function findUnknownTokens(text: string): TokenSite[] {
    return misfitTokens(text)
        .filter(({ malformed }) => !malformed)
        .map(({ line, token }) => ({ line, token }));
}

export function findMalformedRefs(text: string): TokenSite[] {
    return misfitTokens(text)
        .filter(({ malformed }) => malformed)
        .map(({ line, token }) => ({ line, token }));
}

export function findKnownTokens(text: string): TokenSite[] {
    const found: TokenSite[] = [];
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
