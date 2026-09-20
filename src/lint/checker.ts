import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
    GROUND_DIRS,
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
} from '../specification/facets/_common/ground.js';
import {
    assertedStreams,
    readSpecFile,
    SPEC_EXTENSION,
    SpecSyntaxError,
} from '../specification/literate/spec-document.js';
import { TOKEN_KINDS } from '../specification/matching/match.js';
import {
    checkDatabaseProperty,
    checkDeadFixtures,
    checkDockerRunnerAwaitUsing,
    checkLocalFixtureReach,
    checkPoolFixtureSharing,
    checkSuppressionReason,
} from './checker-crossfile.js';
import {
    checkFacetFolder,
    checkGroundOwnedByOne,
    checkModuleTestUnderFacet,
} from './checker-facets.js';
import { checkTestUnderFacet } from './checker-placement.js';
import {
    checkSpecConventions,
    checkSpecDescriptionsUnique,
    volatileLiteralIn,
} from './checker-spec.js';

/**
 * The conventions checker — the non-oxlint static channel.
 *
 * Oxlint only visits JS/TS sources; the D4 token grammar also constrains the
 * DATA fixtures under `_expected/**` and `_requests/**`. This module walks a specs
 * tree and reports:
 *
 * - **unknown / malformed tokens** in `_expected/` fixtures — any text file, not
 *   just `.http`/`.json`/`.txt` (D4);
 * - the **HTTP first-line grammar** of depth-1 `_requests/*.http` (a request line)
 *   and `_expected/*.http` (a status line) (D4b);
 * - **tokens leaking into `_requests/`** — requests are inputs, never matched, so
 *   a `{{token}}` there is almost always a mistake (D10, warning);
 * - the **`<case>.spec.yaml` grammar** wherever a scenario document sits: its
 *   shape (D4b), read through the runner's own parser, plus the token
 *   vocabulary of its streams (D4);
 * - the **document conventions** — key order, naming, description, block
 *   scalars, pinned values, registered names — bundled in `checker-spec.ts`.
 *
 * It shares TOKEN_KINDS with the runtime matcher so the channels cannot drift.
 */

/** A well-formed token: `{{word}}` / `{{word#ref}}`. */
const VALID_TOKEN = /^[A-Za-z][A-Za-z0-9]*(?:#[\w.-]+)?$/u;
/** Any `{{ … }}` block (no nested braces) — classified by the scanner below. */
const BRACE_BLOCK = /\{\{(?<inner>[^{}]*)\}\}/gu;
/** The leading identifier of a brace block, for malformed-ref classification. */
const LEADING_WORD = /^(?<kind>[A-Za-z][A-Za-z0-9]*)/u;

const KNOWN = new Set<string>(TOKEN_KINDS);

/** Directories whose files carry the token grammar (D4). */
const FIXTURE_DIRS = new Set<string>([GROUND_EXPECTED, GROUND_REQUESTS]);

/**
 * Directories the walk never enters. `_fixtures/` trees (the shared pool and
 * the leaf-local ones) are verbatim `.fixture()` cwd material — file STATE, not
 * assertion fixtures — so the token grammar has no meaning inside them.
 */
const SKIPPED_DIRS = new Set<string>(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

/** The four ground names — what a document may never sit under (C16). */
const GROUND_NAMES = new Set<string>(GROUND_DIRS);

/**
 * The passes a run over a `specs/` TREE puts on it.
 *
 * The three `d4*`/`d10w` ids are sub-scans of {@link checkConventionFiles}; the
 * rest are the cross-file and facet passes. The CLI prints this list when a run
 * is clean, so what the reader is told ran is the registry itself.
 */
export const TREE_PASS_IDS = [
    'a7-database-property',
    'b5-await-using-inference',
    'c12-spec-file-name',
    'c14-pool-fixture-shared',
    'c15-local-fixture-reach',
    'c16-document-outside-ground',
    'c18-module-test-under-facet',
    'c20-facet-folder',
    'c21w-ground-owned-by-one',
    'c8-spec-registered-name',
    'c9-dead-fixtures',
    'd10w-tokens-in-requests',
    'd11w-spec-silent-refusal',
    'd4-malformed-ref',
    'd4-unknown-token',
    'd4b-http-first-line',
    'd4b-spec-block-scalar',
    'd4b-spec-key-order',
    'd4b-spec-shape',
    'd5-spec-volatile-literal',
    'd5w-spec-pinned-value',
    'j3w-spec-empty-assertion',
    'j4-spec-description-unique',
    'j9-checker-suppression-reason',
    'j5-spec-description',
] as const;

/**
 * The passes a run over one workspace MEMBER puts on it — what no file under
 * `specs/` can answer: whether the member states how its tests run, whether its
 * config draws a browser, what it declares, and whether a `.spec.ts` of its own
 * ever reached a specs tree.
 */
export const MEMBER_PASS_IDS = [
    'c12-spec-file-name',
    'e3-config-present',
    'e5b-no-simulated-dom-config-member',
    'f8-no-seam-dependency',
] as const;

/**
 * Every logical pass bundled into `dist/checker.js` — the authoritative registry
 * both the manifest catalogue (docs) and the E2E inventory meta-test derive
 * from, so neither can name a pass the CLI does not actually run.
 */
export const CHECKER_PASS_IDS: string[] = [
    ...new Set<string>([...TREE_PASS_IDS, ...MEMBER_PASS_IDS]),
];

export type Severity = 'error' | 'warn';

export type TokenViolation = {
    file: string;
    line: number;
    message: string;
    /**
     * The convention code this finding belongs to, lowercased (`d4`, `c9`,
     * `e3`). It is what the JSON contract publishes as
     * `jterrazz-check(<code>)` and what the toolchain's ratchet counts under
     * `jterrazz-check/<code>` — so a finding without one could never be held
     * down, and the field is required for that reason.
     */
    rule: string;
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
                if (!KNOWN.has(inner.split('#')[0] ?? '')) {
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

/** Known tokens present in a text — for the `_requests/` leak warning (D10). */
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

const REQUEST_LINE = /^(?<method>GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \/\S*/u;
const STATUS_LINE = /^HTTP\/\d(?:\.\d)? \d{3}\b/u;

/**
 * Check one `<case>.spec.yaml` — D4b's shape through the SAME parser the runner
 * uses (one grammar, no drift), then D4's token vocabulary over the STREAMS
 * only: a `{{token}}` in a description or a command is text, never a
 * placeholder, and `stdin:` is an input the comparison never reads.
 *
 * Precision over recall, as everywhere in this channel: the parser refuses at
 * the first defect, so one document reports one grammar violation per run.
 */
export function checkSpecFile(text: string, rel: string): TokenViolation[] {
    let document;
    try {
        document = readSpecFile(text, rel).document;
    } catch (error) {
        if (!(error instanceof SpecSyntaxError)) {
            throw error;
        }
        return [
            {
                file: rel,
                line: error.line,
                message: `${error.message} (D4b — see docs/13-linting.md)`,
                rule: 'd4b',
                severity: 'error',
            },
        ];
    }

    const violations: TokenViolation[] = [];
    for (const stream of assertedStreams(document)) {
        for (const { line, token } of findUnknownTokens(stream.text)) {
            const at = stream.line + line - 1;
            violations.push({
                file: rel,
                line: at,
                message: `${rel}:${at}: unknown token ${token} — the D4 vocabulary is frozen (known: ${[...TOKEN_KINDS].join(', ')})`,
                rule: 'd4',
                severity: 'error',
                token,
            });
        }
    }
    return violations;
}

/**
 * Walk `rootDir` and check every fixture file. Paths in the result are relative
 * to `rootDir`. Errors fail the checker; warnings are advisory.
 */
export function checkConventionFiles(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const visit = (
        dir: string,
        inside: null | typeof GROUND_EXPECTED | typeof GROUND_REQUESTS,
    ): void => {
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
                    ? (entry.name as typeof GROUND_EXPECTED | typeof GROUND_REQUESTS)
                    : inside;
                visit(path, next);
                continue;
            }
            // A spec document lives BESIDE its test, not under ground — it IS
            // The scenario, not material a scenario stands on — so it is
            // Checked wherever the walk finds it, and C16 says where that is.
            if (entry.name.endsWith(SPEC_EXTENSION)) {
                if (rel.split(/[/\\]/u).some((segment) => GROUND_NAMES.has(segment))) {
                    violations.push({
                        file: rel,
                        line: 1,
                        message: `${rel}:1: a \`${SPEC_EXTENSION}\` document is a SPEC, not ground — move it beside the test that runs it (C16 — see docs/13-linting.md)`,
                        rule: 'c16-document-outside-ground',
                        severity: 'error',
                    });
                }
                const text = decodeText(path);
                if (text !== null) {
                    violations.push(
                        ...checkSpecFile(text, rel),
                        ...checkSpecConventions(text, rel, path),
                    );
                }
                continue;
            }
            if (inside === null) {
                continue;
            }
            // Depth-1 = directly under the _requests/ or _expected/ root.
            const depth1 = dir.endsWith(`/${inside}`) || dir.endsWith(`\\${inside}`);

            if (inside === GROUND_REQUESTS) {
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
                        message: `${rel}:1: a _requests/*.http file must start with a request line "METHOD /path" (D4b — see docs/13-linting.md)`,
                        rule: 'd4b',
                        severity: 'error',
                    });
                }
                for (const { line, token } of findKnownTokens(text)) {
                    violations.push({
                        file: rel,
                        line,
                        message: `${rel}:${line}: token ${token} in a _requests/ file — requests are inputs, never matched; tokens are not validated here (D10 — see docs/13-linting.md)`,
                        rule: 'd10w',
                        severity: 'warn',
                        token,
                    });
                }
                continue;
            }

            // _expected/ — every text file carries the token grammar (D4).
            const text = decodeText(path);
            if (text === null) {
                continue; // Binary snapshot — skip.
            }
            if (depth1 && entry.name.endsWith('.http') && !STATUS_LINE.test(firstLine(text))) {
                violations.push({
                    file: rel,
                    line: 1,
                    message: `${rel}:1: an _expected/*.http file must start with a status line "HTTP/1.1 <status>" (D4b — see docs/13-linting.md)`,
                    rule: 'd4b',
                    severity: 'error',
                });
            }
            for (const { line, token } of findUnknownTokens(text)) {
                violations.push({
                    file: rel,
                    line,
                    message: `${rel}:${line}: unknown token ${token} — the D4 vocabulary is frozen (known: ${[...TOKEN_KINDS].join(', ')})`,
                    rule: 'd4',
                    severity: 'error',
                    token,
                });
            }
            // d5 reaches GROUND, not documents alone: a golden that pins a
            // Loopback port, a temp directory or somebody's home passed once,
            // On one machine — the same literal, in the other half of the
            // Same tree.
            for (const [index, line] of text.split('\n').entries()) {
                const volatileLiteral = volatileLiteralIn(line);
                if (volatileLiteral === undefined) {
                    continue;
                }
                violations.push({
                    file: rel,
                    line: index + 1,
                    message: `${rel}:${index + 1}: "${volatileLiteral.found}" is a value the next run will not reproduce — write ${volatileLiteral.token} (D5 — see docs/13-linting.md)`,
                    rule: 'd5-spec-volatile-literal',
                    severity: 'error',
                });
            }
        }
    };
    visit(rootDir, null);
    return violations;
}

/**
 * Run every checker pass over `rootDir`: the token/HTTP grammar passes (D4 /
 * D4b / D10) plus the cross-file passes (C9 dead fixtures, C14/C15 fixture
 * placement, B5 await-using inference, A7 database property). This is the entry
 * the bundled bin drives.
 */
export function runAllChecks(rootDir: string): TokenViolation[] {
    return [
        ...checkTestUnderFacet(rootDir),
        ...checkFacetFolder(rootDir),
        ...checkModuleTestUnderFacet(rootDir),
        ...checkGroundOwnedByOne(rootDir),
        ...checkSuppressionReason(rootDir),
        ...checkConventionFiles(rootDir),
        ...checkSpecDescriptionsUnique(rootDir),
        ...checkDeadFixtures(rootDir),
        ...checkPoolFixtureSharing(rootDir),
        ...checkLocalFixtureReach(rootDir),
        ...checkDockerRunnerAwaitUsing(rootDir),
        ...checkDatabaseProperty(rootDir),
    ];
}

/** Render violations the way the lint chain prints them. One line per finding. */
export function formatViolations(violations: TokenViolation[]): string {
    return violations.map(({ message, severity }) => `[${severity}] ${message}`).join('\n');
}
