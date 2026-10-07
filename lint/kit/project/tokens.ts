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
const BRACE_BLOCK = /\{\{[^{}]*\}\}/gu;
const LEADING_WORD = /^[A-Za-z][A-Za-z0-9]*/u;

const KNOWN = new Set<string>(TOKEN_KINDS);

type TokenSite = { line: number; token: string };

type Verdict = 'known' | 'malformed' | 'unknown';

// invariant: template noise (`{{.Server.Version}}`, `{{ spaced }}`, `{{123}}`) is out of the grammar and ignored; a known kind followed by junk is malformed, never arbitrary noise.
function verdictOf(inner: string): undefined | Verdict {
    if (VALID_TOKEN.test(inner)) {
        const [kind = ''] = inner.split('#');
        return KNOWN.has(kind) ? 'known' : 'unknown';
    }
    // Stryker disable next-line ArrayDeclaration,StringLiteral: no word standing for none is a known kind
    const [word = ''] = LEADING_WORD.exec(inner) ?? [];
    return KNOWN.has(word) ? 'malformed' : undefined;
}

function tokensOf(text: string, verdict: Verdict): TokenSite[] {
    return text
        .split('\n')
        .flatMap((lineText, index) =>
            [...lineText.matchAll(BRACE_BLOCK)].flatMap(([token]) =>
                verdictOf(token.slice(2, -2)) === verdict ? [{ line: index + 1, token }] : [],
            ),
        );
}

export function findUnknownTokens(text: string): TokenSite[] {
    return tokensOf(text, 'unknown');
}

export function findMalformedRefs(text: string): TokenSite[] {
    return tokensOf(text, 'malformed');
}

export function findKnownTokens(text: string): TokenSite[] {
    return tokensOf(text, 'known');
}
