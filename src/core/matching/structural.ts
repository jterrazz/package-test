/**
 * Structural comparison engine shared by every fixture matcher.
 *
 * Handles three kinds of "expected" values:
 * - plain JSON values → strict deep equality
 * - {@link Matcher} instances (code-side `match.*`)
 * - strings containing `{{placeholder}}` forms (file-side fixtures)
 *
 * One unified `{{token}}` grammar (CONVENTIONS D4) — the same vocabulary
 * works in `expected/*.http` (body and headers), `expected/*.json`, and
 * text snapshots (`expected/*.txt`).
 *
 * Ref captures (`match.ref(name)` / `{{type#name}}`) are recorded in the
 * {@link CaptureScope} supplied by the caller.
 */

import { CaptureScope, Matcher, type MatcherKind, TOKEN_KINDS } from './match.js';

// ── Token pattern sources (embedded-in-string contexts) ──

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
// 0-65535 enforced in the pattern itself so embedded {{port}} placeholders
// Reject out-of-range values ("99999") consistently with isPortValue.
const PORT_SOURCE = String.raw`(?:6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|\d{1,4})`;
// Each octet is 0-255, enforced in the pattern itself so embedded {{ip}}
// Placeholders reject out-of-range values ("999.1.1.1") — parity with {{port}}.
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

const wholeRe = (source: string): RegExp => new RegExp(`^(?:${source})$`);

const WHOLE_RES: Partial<Record<MatcherKind, RegExp>> = Object.fromEntries(
    Object.entries(EMBEDDED_SOURCES).map(([kind, source]) => [kind, wholeRe(source!)]),
);

const PLACEHOLDER_RE = new RegExp(
    String.raw`\{\{(?<kind>${[...TOKEN_KINDS].sort((a, b) => b.length - a.length).join('|')})(?:#(?<ref>[\w.-]+))?\}\}`,
    'g',
);

/** Whether a fixture string contains at least one `{{placeholder}}`. */
export function hasPlaceholders(value: string): boolean {
    PLACEHOLDER_RE.lastIndex = 0;
    return PLACEHOLDER_RE.test(value);
}

/** Key-order-independent stringification for captured-object comparison. */
function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
        return `{${entries.join(',')}}`;
    }
    return JSON.stringify(value) ?? 'undefined';
}

function capturedEquals(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
        return true;
    }
    // Cross-context captures: a number captured from JSON must equal its
    // String form captured from text ("42" vs 42).
    if (
        (typeof a === 'number' && typeof b === 'string') ||
        (typeof a === 'string' && typeof b === 'number')
    ) {
        return String(a) === String(b);
    }
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
        // Stable (sorted-key) form: two captures of the same object must be
        // Equal regardless of key insertion order.
        return stableStringify(a) === stableStringify(b);
    }
    return false;
}

function recordRef(name: string, actual: unknown, scope: CaptureScope): boolean {
    if (scope.has(name)) {
        return capturedEquals(scope.get(name), actual);
    }
    scope.set(name, actual);
    return true;
}

function isPortValue(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 65_535;
}

function kindMatches(kind: MatcherKind, actual: unknown, scope: CaptureScope): boolean {
    switch (kind) {
        case 'any': {
            return true;
        }
        case 'float': {
            if (typeof actual === 'number') {
                return Number.isFinite(actual);
            }
            return typeof actual === 'string' && WHOLE_RES.float!.test(actual);
        }
        case 'int': {
            if (typeof actual === 'number') {
                return Number.isInteger(actual);
            }
            return typeof actual === 'string' && WHOLE_RES.int!.test(actual);
        }
        case 'number': {
            if (typeof actual === 'number') {
                return Number.isFinite(actual);
            }
            return typeof actual === 'string' && WHOLE_RES.number!.test(actual);
        }
        case 'port': {
            if (typeof actual === 'number') {
                return isPortValue(actual);
            }
            return (
                typeof actual === 'string' &&
                WHOLE_RES.port!.test(actual) &&
                isPortValue(Number(actual))
            );
        }
        case 'string': {
            return typeof actual === 'string';
        }
        case 'workdir': {
            return typeof actual === 'string' && scope.workdir !== undefined
                ? actual === scope.workdir
                : false;
        }
        default: {
            const re = WHOLE_RES[kind];
            return re !== undefined && typeof actual === 'string' && re.test(actual);
        }
    }
}

function matcherMatches(matcher: Matcher, actual: unknown, scope: CaptureScope): boolean {
    if (matcher.kind === 'regex') {
        return typeof actual === 'string' && matcher.regex!.test(actual);
    }
    if (matcher.kind === 'ref') {
        if (
            matcher.notRef &&
            scope.has(matcher.notRef) &&
            capturedEquals(scope.get(matcher.notRef), actual)
        ) {
            return false;
        }
        return recordRef(matcher.refName!, actual, scope);
    }
    return kindMatches(matcher.kind, actual, scope);
}

interface ParsedPlaceholderString {
    /** Whole-string single placeholder (typed match against any actual). */
    single: null | { kind: MatcherKind; ref?: string };
    /** Embedded form — regex over the string with one group per placeholder. */
    pattern: RegExp;
    refs: { index: number; kind: MatcherKind; ref?: string }[];
}

function placeholderSource(kind: MatcherKind, scope: CaptureScope): string {
    if (kind === 'workdir') {
        // The exact cwd of the spec — known by the framework, never a pattern.
        return scope.workdir === undefined ? '(?!)' : escapeRegExp(scope.workdir);
    }
    const source = EMBEDDED_SOURCES[kind];
    if (source) {
        return source;
    }
    // String: stays on one line; any: crosses lines.
    return kind === 'any' ? String.raw`[\s\S]*?` : String.raw`[^\n]*?`;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function parsePlaceholderString(expected: string, scope: CaptureScope): ParsedPlaceholderString {
    PLACEHOLDER_RE.lastIndex = 0;
    const refs: ParsedPlaceholderString['refs'] = [];
    let pattern = '^';
    let lastIndex = 0;
    let single: ParsedPlaceholderString['single'] = null;
    let count = 0;

    for (const found of expected.matchAll(PLACEHOLDER_RE)) {
        const kind = found.groups!.kind as MatcherKind;
        const ref = found.groups!.ref;
        pattern += escapeRegExp(expected.slice(lastIndex, found.index));
        pattern += `(${placeholderSource(kind, scope)})`;
        refs.push({ index: count, kind, ref });
        count++;
        lastIndex = found.index + found[0].length;
        if (found.index === 0 && found[0].length === expected.length) {
            single = { kind, ref };
        }
    }
    pattern += `${escapeRegExp(expected.slice(lastIndex))}$`;

    return { pattern: new RegExp(pattern), refs, single };
}

function placeholderStringMatches(expected: string, actual: unknown, scope: CaptureScope): boolean {
    const parsed = parsePlaceholderString(expected, scope);

    // Whole-string single placeholder: typed match against the raw actual
    // Value (numbers stay numbers, objects allowed for {{any}}).
    if (parsed.single) {
        if (!kindMatches(parsed.single.kind, actual, scope)) {
            return false;
        }
        if (parsed.single.ref) {
            return recordRef(parsed.single.ref, actual, scope);
        }
        return true;
    }

    // Embedded placeholders: string-level regex match.
    if (typeof actual !== 'string' && typeof actual !== 'number') {
        return false;
    }
    const text = String(actual);
    const found = parsed.pattern.exec(text);
    if (!found) {
        return false;
    }
    for (const entry of parsed.refs) {
        if (!entry.ref) {
            continue;
        }
        if (!recordRef(entry.ref, found[entry.index + 1], scope)) {
            return false;
        }
    }
    return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep structural equality with matcher / placeholder support. Ref captures
 * are recorded in `scope` in traversal order (arrays left-to-right, object
 * keys in expected-key order).
 */
export function structuralEquals(expected: unknown, actual: unknown, scope: CaptureScope): boolean {
    if (expected instanceof Matcher) {
        return matcherMatches(expected, actual, scope);
    }
    if (typeof expected === 'string' && hasPlaceholders(expected)) {
        return placeholderStringMatches(expected, actual, scope);
    }
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || actual.length !== expected.length) {
            return false;
        }
        return expected.every((item, i) => structuralEquals(item, actual[i], scope));
    }
    if (isPlainObject(expected)) {
        if (!isPlainObject(actual)) {
            return false;
        }
        const expectedKeys = Object.keys(expected);
        const actualKeys = Object.keys(actual);
        if (expectedKeys.length !== actualKeys.length) {
            return false;
        }
        return expectedKeys.every(
            (key) => key in actual && structuralEquals(expected[key], actual[key], scope),
        );
    }
    return Object.is(expected, actual);
}

/**
 * Deep structural SUBSET match (toMatchObject-style) with matcher /
 * placeholder support. Plain objects match when every expected key is present
 * and recursively subset-matches — the actual value may carry extra keys.
 * Arrays require equal length with each element subset-matched. Leaves fall
 * back to {@link structuralEquals} semantics (matchers, placeholders, strict
 * equality). Used by request-body filters on intercept triggers.
 */
export function structuralSubset(expected: unknown, actual: unknown, scope: CaptureScope): boolean {
    if (expected instanceof Matcher) {
        return matcherMatches(expected, actual, scope);
    }
    if (typeof expected === 'string' && hasPlaceholders(expected)) {
        return placeholderStringMatches(expected, actual, scope);
    }
    if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || actual.length !== expected.length) {
            return false;
        }
        return expected.every((item, i) => structuralSubset(item, actual[i], scope));
    }
    if (isPlainObject(expected)) {
        if (!isPlainObject(actual)) {
            return false;
        }
        return Object.keys(expected).every(
            (key) => key in actual && structuralSubset(expected[key], actual[key], scope),
        );
    }
    return Object.is(expected, actual);
}

/**
 * Multi-line text comparison with `{{token}}` support — used by text
 * snapshots (`expected/*.txt`). Without placeholders this is strict equality.
 */
export function textEquals(expected: string, actual: string, scope: CaptureScope): boolean {
    if (!hasPlaceholders(expected)) {
        return expected === actual;
    }
    return placeholderStringMatches(expected, actual, scope);
}

/**
 * Render an expected value for failure diffs and serialization: Matcher
 * instances become their placeholder text, everything else is untouched.
 */
export function renderExpected(value: unknown): unknown {
    if (value instanceof Matcher) {
        return value.toString();
    }
    if (Array.isArray(value)) {
        return value.map((item) => renderExpected(item));
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, renderExpected(item)]),
        );
    }
    return value;
}

/**
 * Substitute the framework-known cwd (`workdir`) for its `{{workdir}}` token in
 * every string leaf of a structured value. The structural mirror of the text
 * path's `actual.replaceAll(workdir, '{{workdir}}')` — so a golden written under
 * `TEST_UPDATE=1` stores the token, not a run-specific temp path (CONVENTIONS
 * D5). A no-op when `workdir` is undefined (no cwd, e.g. api/jobs mode).
 */
function substituteWorkdirDeep(value: unknown, workdir: string): unknown {
    if (typeof value === 'string') {
        return value.replaceAll(workdir, '{{workdir}}');
    }
    if (Array.isArray(value)) {
        return value.map((item) => substituteWorkdirDeep(item, workdir));
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, substituteWorkdirDeep(item, workdir)]),
        );
    }
    return value;
}

/**
 * Update-mode merge: rewrite a fixture from the actual output while
 * preserving every segment of the previous fixture that was covered by a
 * placeholder (and still matches the actual value).
 *
 * Token preservation is symmetric with the text path (CONVENTIONS D5): a
 * previous `{{placeholder}}` (including `{{workdir}}`) that still matches the
 * RAW actual value is kept; every other leaf is taken from the actual output
 * with the framework-known cwd substituted back to `{{workdir}}`.
 */
export function mergePreservingPlaceholders(
    previous: unknown,
    actual: unknown,
    workdir?: string,
): unknown {
    const scope = new CaptureScope(workdir);
    const subst = (value: unknown): unknown =>
        workdir === undefined ? value : substituteWorkdirDeep(value, workdir);

    function merge(prev: unknown, act: unknown): unknown {
        // Placeholders match against the RAW actual (so `{{workdir}}` sees the
        // Real cwd); a non-matching leaf falls back to the substituted actual.
        if (typeof prev === 'string' && hasPlaceholders(prev)) {
            return placeholderStringMatches(prev, act, scope) ? prev : subst(act);
        }
        if (Array.isArray(prev) && Array.isArray(act)) {
            return act.map((item, i) => (i < prev.length ? merge(prev[i], item) : subst(item)));
        }
        if (isPlainObject(prev) && isPlainObject(act)) {
            return Object.fromEntries(
                Object.entries(act).map(([key, item]) => [
                    key,
                    key in prev ? merge(prev[key], item) : subst(item),
                ]),
            );
        }
        return subst(act);
    }

    return merge(previous, actual);
}

/**
 * Update-mode merge for text snapshots: line-by-line, a previous line whose
 * placeholders still match the actual line is preserved; every other line is
 * taken from the actual output. Values the framework knows to be dynamic
 * (`{{workdir}}`) are substituted automatically (CONVENTIONS D5).
 */
export function mergeTextPreservingPlaceholders(
    previous: null | string,
    actual: string,
    scope: CaptureScope,
): string {
    const substituted =
        scope.workdir === undefined ? actual : actual.replaceAll(scope.workdir, '{{workdir}}');

    if (previous === null) {
        return substituted;
    }

    const prevLines = previous.split('\n');
    const actualLines = substituted.split('\n');
    const merged = actualLines.map((line, i) => {
        const prev = prevLines[i];
        if (prev === undefined || !hasPlaceholders(prev)) {
            return line;
        }
        // Compare against the raw actual line (workdir already substituted —
        // Placeholders match the substituted form via the literal token).
        return textEquals(prev, line, new CaptureScope(scope.workdir)) ||
            textEquals(prev, actual.split('\n')[i] ?? line, new CaptureScope(scope.workdir))
            ? prev
            : line;
    });
    return merged.join('\n');
}
