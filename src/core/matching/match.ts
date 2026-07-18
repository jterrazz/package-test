/**
 * Code-side dynamic-value matchers (`match.*`) and the capture scope shared
 * by every assertion of a single spec execution.
 *
 * Matchers are used inside `toMatchRows` rows and any structural comparison;
 * their file-side twins are the `{{placeholder}}` forms in `expected/*.http`
 * fixtures (body AND headers), `expected/*.json` files, and text snapshots
 * (`expected/*.txt`). One grammar, one vocabulary (CONVENTIONS D4).
 */

/** The frozen token vocabulary (CONVENTIONS D4) plus the code-only kinds. */
export type MatcherKind =
    | 'any'
    | 'base64'
    | 'date'
    | 'duration'
    | 'email'
    | 'float'
    | 'hex'
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

/** Every kind usable as a `{{token}}` in fixture files (all but ref/regex). */
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

/** A token kind valid inside a fixture `{{...}}` placeholder. */
export type TokenKind = (typeof TOKEN_KINDS)[number];

/**
 * A dynamic-value matcher. Created via the {@link match} factories — never
 * constructed directly by user code.
 */
export class Matcher {
    readonly kind: MatcherKind;
    /** For kind 'ref': the capture to assert inequality against. */
    readonly notRef?: string;
    /** For kind 'ref': the capture name. */
    readonly refName?: string;
    /** For kind 'regex': the pattern the actual value must match. */
    readonly regex?: RegExp;

    constructor(
        kind: MatcherKind,
        options: { notRef?: string; refName?: string; regex?: RegExp } = {},
    ) {
        this.kind = kind;
        this.notRef = options.notRef;
        this.refName = options.refName;
        this.regex = options.regex;
    }

    /** Placeholder-style rendering used in failure diffs and serialization. */
    toString(): string {
        switch (this.kind) {
            case 'ref': {
                return this.notRef
                    ? `{{ref#${this.refName}!${this.notRef}}}`
                    : `{{ref#${this.refName}}}`;
            }
            case 'regex': {
                return `{{regex:${this.regex?.source}}}`;
            }
            default: {
                return this.refName ? `{{${this.kind}#${this.refName}}}` : `{{${this.kind}}}`;
            }
        }
    }

    toJSON(): string {
        return this.toString();
    }
}

const typed = (kind: MatcherKind) => (): Matcher => new Matcher(kind);

/**
 * Dynamic-value matchers for structural comparisons — the code-side mirror of
 * the `{{token}}` fixture grammar (CONVENTIONS D4).
 *
 * @example
 *   await expect(result.table('users', { database: 'db' })).toMatchRows({
 *       columns: ['id', 'name'],
 *       rows: [[match.uuid(), 'Alice']],
 *   });
 */
export const match = {
    /** Matches anything. */
    any: typed('any'),
    /** Matches a base64 string. */
    base64: typed('base64'),
    /** Matches a calendar date (`YYYY-MM-DD`). */
    date: typed('date'),
    /** Matches a human duration (`12ms`, `1.5s`, `2m`, `3h`). */
    duration: typed('duration'),
    /** Matches an email address. */
    email: typed('email'),
    /**
     * Matches a float. In JSON contexts any finite number passes (JSON does
     * not distinguish `42` from `42.0`); in text contexts the decimal part
     * is required (`4.2`, never `42`).
     */
    float: typed('float'),
    /** Matches a hexadecimal string. */
    hex: typed('hex'),
    /** Matches an integer (or an integer string in text contexts). */
    int: typed('int'),
    /** Matches an IPv4 address. */
    ip: typed('ip'),
    /** Matches an ISO-8601 timestamp string. */
    iso8601: typed('iso8601'),
    /** Matches a number (or a numeric string in text contexts). */
    number: typed('number'),
    /** Matches a filesystem path (`/...` or `./...`). */
    path: typed('path'),
    /** Matches a TCP/UDP port number (0-65535). */
    port: typed('port'),
    /**
     * Capture-and-compare. The first occurrence of `ref(name)` captures the
     * actual value; every later occurrence must strictly equal the capture.
     * `{ not: other }` additionally asserts inequality with the capture named
     * `other`. Scope: the current spec execution (reset per chain).
     */
    ref: (name: string, options?: { not?: string }): Matcher =>
        new Matcher('ref', { notRef: options?.not, refName: name }),
    /** Matches a string against the given regular expression. */
    regex: (regex: RegExp): Matcher => new Matcher('regex', { regex }),
    /** Matches a semantic version (`1.2.3`, `2.0.0-rc.1`). */
    semver: typed('semver'),
    /** Matches a git SHA (7-64 hex chars). */
    sha: typed('sha'),
    /** Matches any string. */
    string: typed('string'),
    /** Matches a wall-clock time (`HH:MM` or `HH:MM:SS`). */
    time: typed('time'),
    /** Matches a ULID. */
    ulid: typed('ulid'),
    /** Matches an http(s) URL. */
    url: typed('url'),
    /** Matches a UUID string. */
    uuid: typed('uuid'),
    /** Matches the exact working directory of the current spec. */
    workdir: typed('workdir'),
};

/**
 * Named captures recorded by `match.ref()` / `{{type#ref}}` placeholders.
 * One scope lives on each spec result — every assertion chained off the same
 * result shares it, and a new chain starts fresh.
 */
export class CaptureScope {
    private readonly values = new Map<string, unknown>();
    /**
     * The exact working directory of the current spec, when the framework
     * knows it (cli mode). Drives the `{{workdir}}` token / `match.workdir()`.
     */
    workdir?: string;

    constructor(workdir?: string) {
        this.workdir = workdir;
    }

    get(name: string): unknown {
        return this.values.get(name);
    }

    has(name: string): boolean {
        return this.values.has(name);
    }

    set(name: string, value: unknown): void {
        this.values.set(name, value);
    }
}
