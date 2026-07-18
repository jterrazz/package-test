import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { TOKEN_KINDS } from '../core/matching/match.js';
import {
    checkDatabaseProperty,
    checkDeadFixtures,
    checkDockerRunnerAwaitUsing,
} from './checker-crossfile.js';

/**
 * The conventions checker — the non-oxlint static channel.
 *
 * Oxlint only visits JS/TS sources; the D4 token grammar also constrains the
 * DATA fixtures under `expected/**` and `requests/**`. This module walks a specs
 * tree and reports:
 *
 * - **unknown / malformed tokens** in `expected/` fixtures — any text file, not
 *   just `.http`/`.json`/`.txt` (D4);
 * - the **HTTP first-line grammar** of depth-1 `requests/*.http` (a request line)
 *   and `expected/*.http` (a status line) (D4b);
 * - **tokens leaking into `requests/`** — requests are inputs, never matched, so
 *   a `{{token}}` there is almost always a mistake (D10, warning).
 *
 * It shares TOKEN_KINDS with the runtime matcher so the channels cannot drift.
 */

/** A well-formed token: `{{word}}` / `{{word#ref}}`. */
const VALID_TOKEN = /^[A-Za-z][A-Za-z0-9]*(?:#[\w.-]+)?$/;
/** Any `{{ … }}` block (no nested braces) — classified by the scanner below. */
const BRACE_BLOCK = /\{\{(?<inner>[^{}]*)\}\}/g;
/** The leading identifier of a brace block, for malformed-ref classification. */
const LEADING_WORD = /^(?<kind>[A-Za-z][A-Za-z0-9]*)/;

const KNOWN = new Set<string>(TOKEN_KINDS);

/** Directories whose files carry the token grammar (D4). */
const FIXTURE_DIRS = new Set(['expected', 'requests']);

/**
 * Directories the walk never enters. `fixtures/` trees (the shared pool and
 * feature-local ones) are verbatim `.fixture()` cwd material — file STATE, not
 * assertion fixtures — so the token grammar has no meaning inside them.
 */
const SKIPPED_DIRS = new Set(['.git', 'dist', 'fixtures', 'node_modules']);

/**
 * The logical passes bundled into `dist/checker.js` — the authoritative
 * registry both the manifest catalogue (docs) and the E2E inventory meta-test
 * derive from, so neither can name a pass the CLI does not actually run. The
 * three `d4*`/`d10w` ids are sub-scans of {@link checkConventionFiles}; the rest
 * are the cross-file passes.
 */
export const CHECKER_PASS_IDS = [
    'a7-database-property',
    'b5-await-using-inference',
    'c9-dead-fixtures',
    'd10w-tokens-in-requests',
    'd4-malformed-ref',
    'd4-unknown-token',
    'd4b-http-first-line',
] as const;

export type Severity = 'error' | 'warn';

export type TokenViolation = {
    file: string;
    line: number;
    message: string;
    severity: Severity;
    token?: string;
};

/**
 * Scan one fixture text for tokens outside the grammar: unknown kinds
 * (`{{userid}}`) and malformed captures of a known kind (`{{iso8601#}}`,
 * `{{uuid #id}}`). Well-formed template noise (`{{.Server.Version}}`,
 * `{{ spaced }}`, `{{123}}`) is structurally out of the grammar and ignored.
 */
export function findUnknownTokens(text: string): { line: number; token: string }[] {
    const violations: { line: number; token: string }[] = [];
    const lines = text.split('\n');
    for (const [index, lineText] of lines.entries()) {
        for (const match of lineText.matchAll(BRACE_BLOCK)) {
            const inner = match.groups?.inner ?? '';
            if (VALID_TOKEN.test(inner)) {
                if (!KNOWN.has(inner.split('#')[0])) {
                    violations.push({ line: index + 1, token: match[0] });
                }
                continue;
            }
            // Not a well-formed token: flag only when it starts with a KNOWN
            // Kind followed by junk (a malformed ref), never arbitrary noise.
            const kind = LEADING_WORD.exec(inner)?.groups?.kind;
            if (kind !== undefined && KNOWN.has(kind) && inner !== kind) {
                violations.push({ line: index + 1, token: match[0] });
            }
        }
    }
    return violations;
}

/** Known tokens present in a text — for the `requests/` leak warning (D10). */
export function findKnownTokens(text: string): { line: number; token: string }[] {
    const found: { line: number; token: string }[] = [];
    const lines = text.split('\n');
    for (const [index, lineText] of lines.entries()) {
        for (const match of lineText.matchAll(BRACE_BLOCK)) {
            const inner = match.groups?.inner ?? '';
            if (VALID_TOKEN.test(inner) && KNOWN.has(inner.split('#')[0])) {
                found.push({ line: index + 1, token: match[0] });
            }
        }
    }
    return found;
}

/** A binary file is anything that fails to decode cleanly as UTF-8. */
function decodeText(path: string): null | string {
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return null;
    }
    // Reject bytes that are not valid UTF-8 text (NUL or U+FFFD replacement
    // Char) — a binary snapshot carries no token grammar.
    return text.includes('\u0000') || text.includes('\uFFFD') ? null : text;
}

/** First non-empty line of a text (the HTTP first-line grammar target). */
function firstLine(text: string): string {
    for (const line of text.split('\n')) {
        if (line.trim().length > 0) {
            return line.trim();
        }
    }
    return '';
}

const REQUEST_LINE = /^(?<method>GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/\S*/;
const STATUS_LINE = /^HTTP\/\d(?:\.\d)? \d{3}\b/;

/**
 * Walk `rootDir` and check every fixture file. Paths in the result are relative
 * to `rootDir`. Errors fail the checker; warnings are advisory.
 */
export function checkConventionFiles(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const visit = (dir: string, inside: 'expected' | 'requests' | null): void => {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const path = join(dir, entry.name);
            const rel = relative(rootDir, path);
            if (entry.isDirectory()) {
                if (SKIPPED_DIRS.has(entry.name)) {
                    continue;
                }
                const next = FIXTURE_DIRS.has(entry.name)
                    ? (entry.name as 'expected' | 'requests')
                    : inside;
                visit(path, next);
                continue;
            }
            if (inside === null) {
                continue;
            }
            // Depth-1 = directly under the requests/ or expected/ root.
            const depth1 = dir.endsWith(`/${inside}`) || dir.endsWith(`\\${inside}`);

            if (inside === 'requests') {
                if (!entry.name.endsWith('.http')) {
                    continue; // C2 (oxlint) owns the extension rule.
                }
                const text = decodeText(path);
                if (text === null) {
                    continue;
                }
                if (depth1 && !REQUEST_LINE.test(firstLine(text))) {
                    violations.push({
                        file: rel,
                        line: 1,
                        message: `${rel}:1: a requests/*.http file must start with a request line "METHOD /path" (D4b — see docs/10-linting.md)`,
                        severity: 'error',
                    });
                }
                for (const { line, token } of findKnownTokens(text)) {
                    violations.push({
                        file: rel,
                        line,
                        message: `${rel}:${line}: token ${token} in a requests/ file — requests are inputs, never matched; tokens are not validated here (D10 — see docs/10-linting.md)`,
                        severity: 'warn',
                        token,
                    });
                }
                continue;
            }

            // Expected/ — every text file carries the token grammar (D4).
            const text = decodeText(path);
            if (text === null) {
                continue; // Binary snapshot — skip.
            }
            if (depth1 && entry.name.endsWith('.http') && !STATUS_LINE.test(firstLine(text))) {
                violations.push({
                    file: rel,
                    line: 1,
                    message: `${rel}:1: an expected/*.http file must start with a status line "HTTP/1.1 <status>" (D4b — see docs/10-linting.md)`,
                    severity: 'error',
                });
            }
            for (const { line, token } of findUnknownTokens(text)) {
                violations.push({
                    file: rel,
                    line,
                    message: `${rel}:${line}: unknown token ${token} — the D4 vocabulary is frozen (known: ${[...TOKEN_KINDS].join(', ')})`,
                    severity: 'error',
                    token,
                });
            }
        }
    };
    visit(rootDir, null);
    return violations;
}

/**
 * Run every checker pass over `rootDir`: the token/HTTP grammar passes (D4 /
 * D4b / D10) plus the cross-file passes (C9 dead fixtures, B5 await-using
 * inference, A7 database property). This is the entry the bundled bin drives.
 */
export function runAllChecks(rootDir: string): TokenViolation[] {
    return [
        ...checkConventionFiles(rootDir),
        ...checkDeadFixtures(rootDir),
        ...checkDockerRunnerAwaitUsing(rootDir),
        ...checkDatabaseProperty(rootDir),
    ];
}

/** Render violations the way the lint chain prints them. One line per finding. */
export function formatViolations(violations: TokenViolation[]): string {
    return violations.map(({ message, severity }) => `[${severity}] ${message}`).join('\n');
}
