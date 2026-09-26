import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { TOKEN_KINDS } from '../../src/expectations/tokens/match.js';
import {
    assertedStreams,
    readSpecFile,
    SPEC_EXTENSION,
    SpecSyntaxError,
} from '../../src/facets/cli/documents/spec-document.js';
import { treeEntries } from '../../src/kernel/files/git-tree.js';
import {
    GROUND_DIRS,
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
} from '../../src/kernel/files/ground.js';
import { lessonOf } from '../catalogue/lesson.js';
import type { Teaching } from '../catalogue/lesson.js';
import { checkSuppressionReason } from './checker-suppression-states-a-reason.js';
import { checkDatabaseProperty } from './database-named-only-when-several.js';
import { checkDockerRunnerAwaitUsing } from './docker-exec-bound-with-await-using.js';
import {
    checkSpecConventions,
    checkSpecDescriptionsUnique,
    volatileLiteralIn,
} from './documents.js';
import { checkFacetFolder, checkGroundOwnedByOne, checkModuleTestUnderFacet } from './facets.js';
import { checkTestUnderFacet } from './file-suffix-matches-place.js';
import { checkGroundSharing } from './ground-shared-or-inline.js';
import { checkDiskTargetsExist } from './named-path-exists.js';
import { checkCopiedGround } from './no-duplicate-ground.js';
import { checkLocalFixtureReach } from './no-reach-into-sibling-ground.js';
import { checkDeadFixtures } from './no-unused-ground.js';
import { checkOneSubject, checkSubjectFolder } from './subject.js';

/** Oxlint visits only JS/TS sources, and the `no-unknown-token` grammar also binds the data fixtures; `TOKEN_KINDS` is shared with the runtime matcher so the channels cannot drift. */

const VALID_TOKEN = /^[A-Za-z][A-Za-z0-9]*(?:#[\w.-]+)?$/u;
const BRACE_BLOCK = /\{\{(?<inner>[^{}]*)\}\}/gu;
const LEADING_WORD = /^(?<kind>[A-Za-z][A-Za-z0-9]*)/u;

const KNOWN = new Set<string>(TOKEN_KINDS);

const FIXTURE_DIRS = new Set<string>([GROUND_EXPECTED, GROUND_REQUESTS, GROUND_SEEDS]);

/** Only spellings decidable on sight: the bare word `now` is a column name as often as a clock read. */
const CLOCK_READ = /'now'|\bCURRENT_(?:TIMESTAMP|DATE|TIME)\b|\bNOW\s*\(\s*\)/iu;

const SQL_LINE_COMMENT = /--[^\n]*/gu;
const SQL_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//gu;

/** Line for line, so a finding still points. */
function withoutComments(text: string): string {
    return text
        .replaceAll(SQL_BLOCK_COMMENT, (block) => block.replaceAll(/[^\n]/gu, ' '))
        .replaceAll(SQL_LINE_COMMENT, '');
}

/** `fixtures/` trees are file state, not assertion fixtures: the token grammar has no meaning inside them. */
const SKIPPED_DIRS = new Set<string>(['.git', 'dist', GROUND_FIXTURES, 'node_modules']);

const GROUND_NAMES = new Set<string>(GROUND_DIRS);

/** The CLI prints this list when a run is clean, so what the reader is told ran is the registry itself. */
export const TREE_PASS_IDS = [
    'database-named-only-when-several',
    'docker-exec-bound-with-await-using',
    'file-suffix-matches-place',
    'no-reach-into-sibling-ground',
    'no-document-in-ground',
    'facet-test-uses-its-runner',
    'facet-folder-has-specification',
    'ground-beside-its-only-reader',
    'seeds-state-absolute-time',
    'no-duplicate-ground',
    'ground-shared-or-inline',
    'one-subject-per-spec',
    'spec-in-subject-folder',
    'named-path-exists',
    'document-env-and-serve-registered',
    'no-unused-ground',
    'no-token-in-request',
    'no-silent-refusal',
    'no-malformed-ref',
    'no-unknown-token',
    'http-first-line-follows-its-grammar',
    'document-streams-written-as-block-scalars',
    'document-keys-in-canonical-order',
    'document-follows-its-grammar',
    'no-volatile-literal',
    'pinned-value-from-the-input',
    'no-empty-expected-stream',
    'document-description-unique',
    'checker-suppression-states-a-reason',
    'document-description-is-a-title',
] as const;

export const MEMBER_PASS_IDS = [
    'file-suffix-matches-place',
    'named-path-exists',
    'no-snapshot-folder',
    'member-has-vitest-config',
    'no-simulated-dom-in-config',
    'no-redundant-test-dependency',
] as const;

/** The registry the catalogue and the E2E inventory derive from, so neither names a pass the CLI does not run. */
export const CHECKER_PASS_IDS: string[] = [
    ...new Set<string>([...TREE_PASS_IDS, ...MEMBER_PASS_IDS]),
];

export type CheckerPassId = (typeof MEMBER_PASS_IDS)[number] | (typeof TREE_PASS_IDS)[number];

export type Severity = 'error' | 'warn';

export type TokenViolation<PassId extends string = CheckerPassId> = Teaching & {
    /** A finding about a whole file or folder points at its first column. */
    column?: number;
    file: string;
    line: number;
    /** Published as `jterrazz-check(<code>)`, counted by the ratchet under `jterrazz-check/<code>`. */
    rule: PassId;
    severity: Severity;
    token?: string;
};

export function messageOf(violation: TokenViolation<string>): string {
    return lessonOf(violation.rule, violation);
}

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

function tokenLesson(token: string): Pick<TokenViolation, 'fix' | 'found' | 'rule'> {
    const inner = token.slice(2, -2);
    if (VALID_TOKEN.test(inner)) {
        return {
            fix: `write one of the tokens the vocabulary has, between double braces: ${[...TOKEN_KINDS].join(', ')}`,
            found: `the unknown token ${token}`,
            rule: 'no-unknown-token',
        };
    }
    const kind = LEADING_WORD.exec(inner)?.groups?.kind ?? '';
    return {
        fix: `write ${kind} bare, or its named capture ${kind}#<name>, between double braces`,
        found: `the malformed token ${token}`,
        rule: 'no-malformed-ref',
    };
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

function decodeText(path: string): null | string {
    let text;
    try {
        text = readFileSync(path, 'utf8');
    } catch {
        return null;
    }
    // A NUL or a U+FFFD replacement char: a binary snapshot carries no token grammar.
    return text.includes('\u0000') || text.includes('\uFFFD') ? null : text;
}

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

/** `document-follows-its-grammar` through the runner's own parser, then `no-unknown-token` over the streams only: a `{{token}}` in a description or a command is text, and `stdin:` is never compared. */
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
                fix: 'rewrite the document to its grammar — chapter 20 lists the keys, their order and what each run requires',
                found: error.reason,
                rule: 'document-follows-its-grammar',
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
                ...tokenLesson(token),
                severity: 'error',
                token,
            });
        }
    }
    return violations;
}

/** The chain's `.clock()` pins what the code reads, so a seed never asks the machine; under SQLite `datetime('now')` also writes a space where an ORM writes `T`, and the two mis-sort. */
function checkSeedClockReads(path: string, rel: string, name: string): TokenViolation[] {
    // `seeds-are-sql` (oxlint) owns the extension rule; this pass reads the SQL alone.
    if (!name.endsWith('.sql')) {
        return [];
    }
    const text = decodeText(path);
    if (text === null) {
        return [];
    }
    const violations: TokenViolation[] = [];
    for (const [index, line] of withoutComments(text).split('\n').entries()) {
        const found = CLOCK_READ.exec(line);
        if (found === null) {
            continue;
        }
        violations.push({
            file: rel,
            line: index + 1,
            fix: `replace \`${found[0]}\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\``,
            found: `\`${found[0]}\` reads the clock in a seed`,
            rule: 'seeds-state-absolute-time',
            severity: 'error',
        });
    }
    return violations;
}

export function checkConventionFiles(rootDir: string): TokenViolation[] {
    const violations: TokenViolation[] = [];
    const visit = (
        dir: string,
        inside: null | typeof GROUND_EXPECTED | typeof GROUND_REQUESTS | typeof GROUND_SEEDS,
    ): void => {
        let entries;
        try {
            entries = treeEntries(dir);
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
                    ? (entry.name as
                          | typeof GROUND_EXPECTED
                          | typeof GROUND_REQUESTS
                          | typeof GROUND_SEEDS)
                    : inside;
                visit(path, next);
                continue;
            }
            // A spec document is the scenario, not ground, so it is checked wherever the walk finds it; `no-document-in-ground` says where that is.
            if (entry.name.endsWith(SPEC_EXTENSION)) {
                if (rel.split(/[/\\]/u).some((segment) => GROUND_NAMES.has(segment))) {
                    violations.push({
                        file: rel,
                        line: 1,
                        fix: `move ${entry.name} out of the ground folder, beside the test that runs it`,
                        found: `a \`${SPEC_EXTENSION}\` document under a ground folder`,
                        rule: 'no-document-in-ground',
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
            const depth1 = dir.endsWith(`/${inside}`) || dir.endsWith(`\\${inside}`);

            if (inside === GROUND_SEEDS) {
                violations.push(...checkSeedClockReads(path, rel, entry.name));
                continue;
            }

            if (inside === GROUND_REQUESTS) {
                if (!entry.name.endsWith('.http')) {
                    continue; // `request-file-extension-known` (oxlint) owns the extension rule.
                }
                const text = decodeText(path);
                if (text === null) {
                    continue;
                }
                if (depth1 && !REQUEST_LINE.test(firstLine(text))) {
                    violations.push({
                        file: rel,
                        line: 1,
                        fix: `start ${entry.name} with its request line, \`GET /path\` or another method`,
                        found: `the first line of ${entry.name} is no request line`,
                        rule: 'http-first-line-follows-its-grammar',
                        severity: 'error',
                    });
                }
                for (const { line, token } of findKnownTokens(text)) {
                    violations.push({
                        file: rel,
                        line,
                        fix: 'write the literal value the request sends — a request is sent, never matched',
                        found: `the token ${token} in a requests/ file`,
                        rule: 'no-token-in-request',
                        severity: 'warn',
                        token,
                    });
                }
                continue;
            }

            const text = decodeText(path);
            if (text === null) {
                continue;
            }
            if (depth1 && entry.name.endsWith('.http') && !STATUS_LINE.test(firstLine(text))) {
                violations.push({
                    file: rel,
                    line: 1,
                    fix: `start ${entry.name} with its status line, \`HTTP/1.1 200 OK\` or the status it expects`,
                    found: `the first line of ${entry.name} is no status line`,
                    rule: 'http-first-line-follows-its-grammar',
                    severity: 'error',
                });
            }
            for (const { line, token } of findUnknownTokens(text)) {
                violations.push({
                    file: rel,
                    line,
                    ...tokenLesson(token),
                    severity: 'error',
                    token,
                });
            }
            // `no-volatile-literal` reaches ground as well as documents: the same volatile literal in the other half of the tree.
            for (const [index, line] of text.split('\n').entries()) {
                const volatileLiteral = volatileLiteralIn(line);
                if (volatileLiteral === undefined) {
                    continue;
                }
                violations.push({
                    file: rel,
                    line: index + 1,
                    fix: `write ${volatileLiteral.token} where "${volatileLiteral.found}" stands`,
                    found: `"${volatileLiteral.found}", a value the next run will not reproduce`,
                    rule: 'no-volatile-literal',
                    severity: 'error',
                });
            }
        }
    };
    visit(rootDir, null);
    return violations;
}

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
        ...checkGroundSharing(rootDir),
        ...checkOneSubject(rootDir),
        ...checkSubjectFolder(rootDir),
        ...checkCopiedGround(rootDir),
        ...checkLocalFixtureReach(rootDir),
        ...checkDiskTargetsExist(rootDir),
        ...checkDockerRunnerAwaitUsing(rootDir),
        ...checkDatabaseProperty(rootDir),
    ];
}

/** The compiler convention every editor's problem matcher parses, and oxlint's findings normalise to. */
export function reportLine(violation: TokenViolation<string>, message: string): string {
    const { column, file, line, rule, severity } = violation;
    const level = severity === 'error' ? 'error' : 'warning';
    return `${file}:${line}:${column ?? 1}: ${level} jterrazz-check(${rule}): ${message}`;
}

export function formatViolation(violation: TokenViolation<string>): string {
    return reportLine(violation, messageOf(violation));
}

export function formatViolations(violations: TokenViolation<string>[]): string {
    return violations.map(formatViolation).join('\n');
}
