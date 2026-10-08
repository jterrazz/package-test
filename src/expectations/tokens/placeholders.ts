import { isRecord } from '../../../lint/kit/project/json-shape.js';
import { TOKEN_KINDS } from '../../../lint/kit/project/tokens.js';
import { isFramedInLine, piecesMatch } from './any-lines.js';
import { CaptureScope } from './capture-scope.js';
import type { Matcher, MatcherKind } from './match.js';

const UUID_SOURCE = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const ULID_SOURCE = '[0-9A-HJKMNP-TV-Z]{26}';
const ISO8601_SOURCE = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})`;
const DATE_SOURCE = String.raw`\d{4}-\d{2}-\d{2}`;
const TIME_SOURCE = String.raw`\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?`;
const DURATION_SOURCE = String.raw`\d+(?:\.\d+)?(?:ms|s|m|h)`;
const NUMBER_SOURCE = String.raw`-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?`;
const INT_SOURCE = String.raw`-?\d+`;
const FLOAT_SOURCE = String.raw`-?\d+\.\d+`;
const SEMVER_SOURCE = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?`;
const SHA_SOURCE = '[0-9a-f]{7,64}';
const HEX_SOURCE = '[0-9a-fA-F]+';
const BASE64_SOURCE = '[A-Za-z0-9+/]+={0,2}';
// value: the range lives in the pattern, so an embedded `{{port}}` rejects "99999".
const PORT_SOURCE = String.raw`(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|\d{1,4})`;
// value: each octet 0-255 in the pattern itself, so embedded `{{ip}}` rejects "999.1.1.1".
const IP_OCTET = String.raw`(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;
const IP_SOURCE = String.raw`(?:${IP_OCTET}\.){3}${IP_OCTET}`;
const URL_SOURCE = String.raw`https?:\/\/[^\s"'<>]+`;
const EMAIL_SOURCE = String.raw`[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+`;
const PATH_SOURCE = String.raw`\.{0,2}\/[^\s"'<>]*`;

const EMBEDDED_SOURCES: Partial<Record<MatcherKind, string>> = {
    base64: BASE64_SOURCE,
    date: DATE_SOURCE,
    duration: DURATION_SOURCE,
    email: EMAIL_SOURCE,
    float: FLOAT_SOURCE,
    hex: HEX_SOURCE,
    int: INT_SOURCE,
    ip: IP_SOURCE,
    iso8601: ISO8601_SOURCE,
    number: NUMBER_SOURCE,
    path: PATH_SOURCE,
    port: PORT_SOURCE,
    semver: SEMVER_SOURCE,
    sha: SHA_SOURCE,
    time: TIME_SOURCE,
    ulid: ULID_SOURCE,
    url: URL_SOURCE,
    uuid: UUID_SOURCE,
};

const wholeRe = (source: string): RegExp => new RegExp(`^(?:${source})$`, 'u');

const WHOLE_RES: Partial<Record<MatcherKind, RegExp>> = Object.fromEntries(
    Object.entries(EMBEDDED_SOURCES).map(([kind, source]) => [kind, wholeRe(source)]),
);

const wholeMatches = (kind: MatcherKind, actual: string): boolean =>
    // Stryker disable next-line OptionalChaining: every kind read here has a pattern; any, string and workdir are answered before
    WHOLE_RES[kind]?.test(actual) === true;

const PLACEHOLDER_RE = new RegExp(
    String.raw`\{\{(?<kind>${[...TOKEN_KINDS].toSorted((a, b) => b.length - a.length).join('|')})(?:#(?<ref>[\w.-]+))?\}\}`,
    'gu',
);

export function hasPlaceholders(value: string): boolean {
    PLACEHOLDER_RE.lastIndex = 0;
    return PLACEHOLDER_RE.test(value);
}

// invariant: its keys sorted at every depth, so two captures of one object read alike whatever their key order.
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => canonical(item));
    }
    if (!isRecord(value)) {
        return value;
    }
    return Object.fromEntries(
        Object.keys(value)
            .toSorted()
            .map((key) => [key, canonical(value[key])]),
    );
}

function capturedEquals(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
        return true;
    }
    // invariant: cross-context captures: a number from JSON equals its string form from text.
    if (
        (typeof a === 'number' && typeof b === 'string') ||
        (typeof a === 'string' && typeof b === 'number')
    ) {
        return String(a) === String(b);
    }
    return (
        typeof a === 'object' &&
        typeof b === 'object' &&
        JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
    );
}

export function recordRef(name: string, actual: unknown, scope: CaptureScope): boolean {
    if (scope.has(name)) {
        return capturedEquals(scope.get(name), actual);
    }
    scope.set(name, actual);
    return true;
}

function isPortValue(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 65_535;
}

const NUMERIC_KINDS: Partial<Record<MatcherKind, (value: number) => boolean>> = {
    float: Number.isFinite,
    int: Number.isInteger,
    number: Number.isFinite,
    port: isPortValue,
};

export function kindMatches(kind: MatcherKind, actual: unknown, scope: CaptureScope): boolean {
    if (kind === 'any') {
        return true;
    }
    if (kind === 'workdir') {
        return typeof actual === 'string' && actual === scope.workdir;
    }
    const numeric = NUMERIC_KINDS[kind];
    if (numeric !== undefined && typeof actual === 'number') {
        return numeric(actual);
    }
    if (typeof actual !== 'string') {
        return false;
    }
    if (kind === 'string') {
        return true;
    }
    // invariant: the port pattern holds the range itself.
    return wholeMatches(kind, actual);
}

export function matcherMatches(matcher: Matcher, actual: unknown, scope: CaptureScope): boolean {
    if (matcher.kind === 'includes') {
        return (
            typeof actual === 'string' &&
            matcher.includes !== undefined &&
            actual.includes(matcher.includes)
        );
    }
    if (matcher.kind === 'regex') {
        return typeof actual === 'string' && matcher.regex?.test(actual) === true;
    }
    if (matcher.kind === 'ref') {
        if (
            // Stryker disable next-line ConditionalExpression,LogicalOperator: no capture is held under no name
            matcher.notRef !== undefined &&
            scope.has(matcher.notRef) &&
            capturedEquals(scope.get(matcher.notRef), actual)
        ) {
            return false;
        }
        return matcher.refName !== undefined && recordRef(matcher.refName, actual, scope);
    }
    return kindMatches(matcher.kind, actual, scope);
}

type ParsedPlaceholderString = {
    // invariant: the literal text around each token, when every token is an unnamed `{{any}}`; null otherwise.
    pieces: null | string[];
    single: null | { kind: MatcherKind; ref?: string | undefined };
    pattern: RegExp;
    refs: { index: number; kind: MatcherKind; ref?: string | undefined }[];
    source: string;
};

function placeholderSource(kind: MatcherKind, scope: CaptureScope, inLine: boolean): string {
    if (kind === 'workdir') {
        return scope.workdir === undefined ? '(?!)' : escapeRegExp(scope.workdir);
    }
    const source = EMBEDDED_SOURCES[kind];
    if (source !== undefined) {
        return source;
    }
    // invariant: string stays on one line; any crosses lines, but where its line holds text on both sides of it, the line is its frame.
    return kind === 'any' && !inLine ? String.raw`[\s\S]*?` : String.raw`[^\n]*?`;
}

function escapeRegExp(text: string): string {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

export function parsePlaceholderString(
    expected: string,
    scope: CaptureScope,
): ParsedPlaceholderString {
    PLACEHOLDER_RE.lastIndex = 0;
    const tokens = [...expected.matchAll(PLACEHOLDER_RE)].flatMap((found) => {
        const { kind: written, ref } = found.groups ?? {};
        const kind = TOKEN_KINDS.find((known) => known === written);
        // Stryker disable next-line ConditionalExpression,ArrayDeclaration: the pattern names the token kinds alone
        return kind === undefined ? [] : [{ found, kind, ref }];
    });
    let source = '';
    let lastIndex = 0;
    const pieces: string[] = [];
    let framed = false;
    for (const { found, kind } of tokens) {
        const inLine = isFramedInLine(expected, found.index, found.index + found[0].length);
        // Stryker disable next-line ConditionalExpression: the pattern reads what the pieces read, only slower on a long golden
        framed ||= kind === 'any' && inLine;
        pieces.push(expected.slice(lastIndex, found.index));
        source += `${escapeRegExp(expected.slice(lastIndex, found.index))}(${placeholderSource(kind, scope, inLine)})`;
        lastIndex = found.index + found[0].length;
    }
    pieces.push(expected.slice(lastIndex));
    source += escapeRegExp(expected.slice(lastIndex));
    const [only] = tokens;
    return {
        pieces:
            !framed && tokens.every(({ kind, ref }) => kind === 'any' && ref === undefined)
                ? pieces
                : null,
        // Stryker disable next-line StringLiteral: the token patterns are ASCII, read alike without the unicode flag
        pattern: new RegExp(`^${source}$`, 'u'),
        refs: tokens.map(({ kind, ref }, index) => ({ index, kind, ref })),
        single: only?.found[0] === expected ? { kind: only.kind, ref: only.ref } : null,
        source,
    };
}

export function placeholderPatternSource(expected: string): string {
    return parsePlaceholderString(expected, new CaptureScope()).source;
}

export function placeholderStringMatches(
    expected: string,
    actual: unknown,
    scope: CaptureScope,
): boolean {
    const parsed = parsePlaceholderString(expected, scope);

    if (parsed.single) {
        if (!kindMatches(parsed.single.kind, actual, scope)) {
            return false;
        }
        if (parsed.single.ref !== undefined) {
            return recordRef(parsed.single.ref, actual, scope);
        }
        return true;
    }

    if (typeof actual !== 'string' && typeof actual !== 'number') {
        return false;
    }
    const text = String(actual);
    if (parsed.pieces !== null) {
        return piecesMatch(parsed.pieces, text);
    }
    const found = parsed.pattern.exec(text);
    if (!found) {
        return false;
    }
    for (const entry of parsed.refs) {
        if (entry.ref === undefined) {
            continue;
        }
        if (!recordRef(entry.ref, found[entry.index + 1], scope)) {
            return false;
        }
    }
    return true;
}
