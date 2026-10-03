import type { TokenKind } from '../../../lint/kit/project/tokens.js';

/** The frozen token vocabulary (rule `no-unknown-token`) plus the code-only kinds. */
export type MatcherKind =
    | 'any'
    | 'base64'
    | 'date'
    | 'duration'
    | 'email'
    | 'float'
    | 'hex'
    | 'includes'
    | 'int'
    | 'ip'
    | 'iso8601'
    | 'number'
    | 'path'
    | 'port'
    | 'ref'
    | 'regex'
    | 'semver'
    | 'sha'
    | 'string'
    | 'time'
    | 'ulid'
    | 'url'
    | 'uuid'
    | 'workdir';

/** A dynamic-value matcher, created through the `match` factories. */
export class Matcher {
    /** For kind 'includes': the substring the actual value must contain. */
    readonly includes?: string | undefined;
    readonly kind: MatcherKind;
    /** For kind 'ref': the capture to assert inequality against. */
    readonly notRef?: string | undefined;
    /** For kind 'ref': the capture name. */
    readonly refName?: string | undefined;
    /** For kind 'regex': the pattern the actual value must match. */
    readonly regex?: RegExp | undefined;

    constructor(
        kind: MatcherKind,
        options: {
            includes?: string | undefined;
            notRef?: string | undefined;
            refName?: string | undefined;
            regex?: RegExp | undefined;
        } = {},
    ) {
        this.includes = options.includes;
        this.kind = kind;
        this.notRef = options.notRef;
        this.refName = options.refName;
        this.regex = options.regex;
    }

    /** Placeholder-style rendering used in failure diffs and serialization. */
    toString(): string {
        if (this.kind === 'includes') {
            return `{{includes:${this.includes}}}`;
        }
        if (this.kind === 'regex') {
            return `{{regex:${this.regex?.source}}}`;
        }
        if (this.kind === 'ref') {
            return this.notRef === undefined
                ? `{{ref#${this.refName}}}`
                : `{{ref#${this.refName}!${this.notRef}}}`;
        }
        return this.refName === undefined ? `{{${this.kind}}}` : `{{${this.kind}#${this.refName}}}`;
    }

    toJSON(): string {
        return this.toString();
    }
}

type TypedMatcher = () => Matcher;

const typed =
    (kind: MatcherKind): TypedMatcher =>
    (): Matcher =>
        new Matcher(kind);

/** Dynamic-value matchers, the code-side mirror of the `{{token}}` grammar (`no-unknown-token`). */
export type MatchFactories = Record<TokenKind, TypedMatcher> & {
    includes: (substring: string) => Matcher;
    ref: (name: string, options?: { not?: string }) => Matcher;
    regex: (regex: RegExp) => Matcher;
};

export const match: MatchFactories = {
    any: typed('any'),
    base64: typed('base64'),
    /** Matches a calendar date (`YYYY-MM-DD`). */
    date: typed('date'),
    /** Matches a human duration (`12ms`, `1.5s`, `2m`, `3h`). */
    duration: typed('duration'),
    email: typed('email'),
    /** Matches a float: any finite number in JSON; in text the decimal part is required. */
    float: typed('float'),
    hex: typed('hex'),
    /** Matches a string containing the substring; code-only, like `match.regex`. */
    includes: (substring: string): Matcher => new Matcher('includes', { includes: substring }),
    /** Matches an integer (or an integer string in text contexts). */
    int: typed('int'),
    /** Matches an IPv4 address. */
    ip: typed('ip'),
    iso8601: typed('iso8601'),
    /** Matches a number (or a numeric string in text contexts). */
    number: typed('number'),
    /** Matches a filesystem path (`/...` or `./...`). */
    path: typed('path'),
    /** Matches a TCP/UDP port number (0-65535). */
    port: typed('port'),
    /** Capture-and-compare: the first `ref(name)` captures, every later one must equal it; `{ not }` asserts inequality. */
    ref: (name: string, options?: { not?: string }): Matcher =>
        new Matcher('ref', { notRef: options?.not, refName: name }),
    regex: (regex: RegExp): Matcher => new Matcher('regex', { regex }),
    /** Matches a semantic version (`1.2.3`, `2.0.0-rc.1`). */
    semver: typed('semver'),
    /** Matches a git SHA (7-64 hex chars). */
    sha: typed('sha'),
    string: typed('string'),
    /** Matches a wall-clock time (`HH:MM` or `HH:MM:SS`). */
    time: typed('time'),
    ulid: typed('ulid'),
    /** Matches an http(s) URL. */
    url: typed('url'),
    uuid: typed('uuid'),
    /** Matches the exact working directory of the current spec. */
    workdir: typed('workdir'),
};
