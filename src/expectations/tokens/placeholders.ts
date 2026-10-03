import { TOKEN_KINDS } from '../../../lint/kit/project/tokens.js';
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
    WHOLE_RES[kind]?.test(actual) === true;

const PLACEHOLDER_RE = new RegExp(
    String.raw`\{\{(?<kind>${[...TOKEN_KINDS].toSorted((a, b) => b.length - a.length).join('|')})(?:#(?<ref>[\w.-]+))?\}\}`,
    'gu',
);

export function hasPlaceholders(value: string): boolean {
    PLACEHOLDER_RE.lastIndex = 0;
    return PLACEHOLDER_RE.test(value);
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value)
            .toSorted(([a], [b]) => (a < b ? -1 : 1))
            .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
        return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value) ?? 'undefined';
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
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
        // invariant: sorted-key form: two captures of one object are equal whatever the key order.
        return stableStringify(a) === stableStringify(b);
    }
    return false;
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
        return (
            typeof actual === 'string' && scope.workdir !== undefined && actual === scope.workdir
        );
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
    return wholeMatches(kind, actual) && (kind !== 'port' || isPortValue(Number(actual)));
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
    single: null | { kind: MatcherKind; ref?: string | undefined };
    pattern: RegExp;
    refs: { index: number; kind: MatcherKind; ref?: string | undefined }[];
    source: string;
};

function placeholderSource(kind: MatcherKind, scope: CaptureScope): string {
    if (kind === 'workdir') {
        return scope.workdir === undefined ? '(?!)' : escapeRegExp(scope.workdir);
    }
    const source = EMBEDDED_SOURCES[kind];
    if (source !== undefined) {
        return source;
    }
    // invariant: string: stays on one line; any: crosses lines.
    return kind === 'any' ? String.raw`[\s\S]*?` : String.raw`[^\n]*?`;
}

function escapeRegExp(text: string): string {
    return text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

export function parsePlaceholderString(
    expected: string,
    scope: CaptureScope,
): ParsedPlaceholderString {
    PLACEHOLDER_RE.lastIndex = 0;
    const refs: ParsedPlaceholderString['refs'] = [];
    let source = '';
    let lastIndex = 0;
    let single: ParsedPlaceholderString['single'] = null;
    let count = 0;

    for (const found of expected.matchAll(PLACEHOLDER_RE)) {
        const kind = TOKEN_KINDS.find((known) => known === found.groups?.kind);
        if (kind === undefined) {
            continue;
        }
        const ref = found.groups?.ref;
        source += escapeRegExp(expected.slice(lastIndex, found.index));
        source += `(${placeholderSource(kind, scope)})`;
        refs.push({ index: count, kind, ref });
        count++;
        lastIndex = found.index + found[0].length;
        if (found.index === 0 && found[0].length === expected.length) {
            single = { kind, ref };
        }
    }
    source += escapeRegExp(expected.slice(lastIndex));

    return { pattern: new RegExp(`^${source}$`, 'u'), refs, single, source };
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
