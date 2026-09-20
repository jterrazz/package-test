/**
 * Vitest custom matchers for `@jterrazz/test` accessors.
 *
 * Auto-registered (idempotently) on the first `specification.api()` /
 * `specification.jobs()` / `specification.cli()` call via a dynamic
 * `import('vitest')` — the library never hard-imports vitest at module load.
 *
 * All assertions go through `expect()` (CONVENTIONS D1). Only matchers that
 * do IO are async (D2): `table` (SQL query), `filesystem`/`directory`
 * (disk walk), `container` (docker). Everything else is synchronous.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { ContainerAccessor } from '../integrations/docker/container-accessor.js';
import { GROUND_EXPECTED } from '../specification/facets/_common/ground.js';
import {
    formatDirectoryDiff,
    formatResponseDiff,
    formatTableDiff,
} from '../specification/facets/_common/reporter.js';
import {
    diffDirectories,
    DirectoryAccessor,
    walkDirectory,
} from '../specification/facets/_common/result/directory.js';
import { FilesystemAccessor } from '../specification/facets/_common/result/filesystem.js';
import { JsonAccessor } from '../specification/facets/_common/result/json.js';
import type { MatchFixtureOptions } from '../specification/facets/_common/result/match-options.js';
import { ResponseAccessor } from '../specification/facets/_common/result/response.js';
import { TableAccessor } from '../specification/facets/_common/result/table.js';
import {
    compareStreamText,
    nativeContain,
    nativeMatch,
    requireExtension,
    textContains,
    textIsEmpty,
} from '../specification/facets/_common/result/text-assertions.js';
import { TextAccessor } from '../specification/facets/_common/result/text.js';
import { parseResponseFile, serializeResponseFile } from '../specification/http-files/http-file.js';
import type { ParsedResponseFile } from '../specification/http-files/http-file.js';
import { CaptureScope } from '../specification/matching/match.js';
import {
    mergePreservingPlaceholders,
    mergeTextPreservingPlaceholders,
    renderExpected,
    structuralEquals,
} from '../specification/matching/structural.js';
import { missingHint, shouldUpdateSnapshots } from './update.js';

type MatcherResult = {
    message: () => string;
    pass: boolean;
};

const PASS = (label: string): MatcherResult => ({ message: () => label, pass: true });
const FAIL = (message: string): MatcherResult => ({ message: () => message, pass: false });

function formatJson(value: unknown): string {
    return `${JSON.stringify(value, null, 4)}\n`;
}

// ── toMatch — sync subjects ──

function matchStreamFile(accessor: TextAccessor, name: string, frozen: boolean): MatcherResult {
    requireExtension(name, 'stream');
    const filePath = resolve(accessor.testDir, GROUND_EXPECTED, name);
    const actual = accessor.comparableText;

    if (shouldUpdateSnapshots() && !frozen) {
        // Update mode writes TOKENS, not values: placeholder-covered lines of
        // The previous fixture are preserved, and values the framework knows
        // To be dynamic ({{workdir}}) are substituted (CONVENTIONS D5).
        const previous = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
        const merged = mergeTextPreservingPlaceholders(previous, actual, accessor.captures);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, merged);
        return PASS(`updated ${GROUND_EXPECTED}/${name}`);
    }

    if (!existsSync(filePath)) {
        return FAIL(
            `${accessor.streamName} fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    return compareStreamText(accessor, name, readFileSync(filePath, 'utf8'));
}

function matchJsonFile(accessor: JsonAccessor, name: string, frozen: boolean): MatcherResult {
    requireExtension(name, 'json');
    const filePath = resolve(accessor.testDir, GROUND_EXPECTED, name);
    const actual = accessor.value;

    if (shouldUpdateSnapshots() && !frozen) {
        // Writes TOKENS, not values — parity with the text path: preserve
        // Still-matching placeholders and substitute the known cwd back to
        // {{workdir}} (CONVENTIONS D5).
        const merged = existsSync(filePath)
            ? mergePreservingPlaceholders(
                  JSON.parse(readFileSync(filePath, 'utf8')),
                  actual,
                  accessor.captures.workdir,
              )
            : mergePreservingPlaceholders(null, actual, accessor.captures.workdir);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, formatJson(merged));
        return PASS(`updated ${GROUND_EXPECTED}/${name}`);
    }

    if (!existsSync(filePath)) {
        return FAIL(
            `JSON fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    const expected = JSON.parse(readFileSync(filePath, 'utf8'));
    if (structuralEquals(expected, actual, accessor.captures)) {
        return PASS(`expected JSON not to match ${GROUND_EXPECTED}/${name}`);
    }
    return FAIL(formatResponseDiff(name, renderExpected(expected), actual));
}

/** The parts of a response a fixture is checked against. */
type ActualResponse = {
    body: unknown;
    /** Flat, lower-cased key-value map. */
    headers: Record<string, string>;
    status: number;
};

/**
 * Build the updated `_expected/*.http` fixture content from the previous
 * fixture and the actual response (CONVENTIONS D5). Headers are the
 * INTERSECTION with the actual response: placeholders still matching are
 * preserved, stale values are replaced, headers absent from the actual
 * response are dropped — so a freshly updated fixture passes the next run.
 *
 * @internal Exported for unit tests.
 */
export function buildUpdatedResponse(
    previous: null | ParsedResponseFile,
    actual: ActualResponse,
    workdir?: string,
): ParsedResponseFile {
    const scope = new CaptureScope();
    const status =
        previous && structuralEquals(previous.status, String(actual.status), scope)
            ? previous.status
            : String(actual.status);

    const headers: Record<string, string> = {};
    if (previous) {
        for (const [key, value] of Object.entries(previous.headers)) {
            const actualValue = actual.headers[key.toLowerCase()];
            if (actualValue === undefined) {
                continue;
            }
            headers[key] = structuralEquals(value, actualValue, scope) ? value : actualValue;
        }
    } else if (actual.headers['content-type']) {
        headers['content-type'] = actual.headers['content-type'];
    }

    const hasBody = actual.body !== null && actual.body !== undefined;
    // Body tokens are preserved and the known cwd substituted back to
    // {{workdir}} — parity with the text and JSON update paths (CONVENTIONS D5).
    const body =
        previous?.hasBody && hasBody
            ? mergePreservingPlaceholders(previous.body, actual.body, workdir)
            : mergePreservingPlaceholders(null, actual.body, workdir);

    return { body, hasBody, headers, status };
}

/**
 * Compare a parsed `_expected/*.http` fixture against an actual response.
 * Returns the failure message, or null when everything matches.
 *
 * @internal Exported for unit tests.
 */
export function compareResponse(
    name: string,
    expected: ParsedResponseFile,
    actual: ActualResponse,
    scope: CaptureScope,
): null | string {
    // Status — supports placeholders ("HTTP/1.1 {{number}}").
    const statusOk = /^\d+$/u.test(expected.status)
        ? Number(expected.status) === actual.status
        : structuralEquals(expected.status, String(actual.status), scope);
    if (!statusOk) {
        return (
            `Response status mismatch (${name})\n` +
            `  expected: ${expected.status}\n` +
            `  received: ${actual.status}`
        );
    }

    // Headers — SUBSET semantics: only headers listed in the fixture are asserted.
    for (const [key, value] of Object.entries(expected.headers)) {
        const actualValue = actual.headers[key.toLowerCase()];
        if (actualValue === undefined || !structuralEquals(value, actualValue, scope)) {
            return (
                `Response header mismatch (${name})\n` +
                `  header: ${key}\n` +
                `  expected: ${value}\n` +
                `  received: ${actualValue ?? '(absent)'}`
            );
        }
    }

    // Body.
    if (expected.hasBody && !structuralEquals(expected.body, actual.body, scope)) {
        return formatResponseDiff(name, renderExpected(expected.body), actual.body);
    }

    return null;
}

function matchResponseFile(
    accessor: ResponseAccessor,
    name: string,
    frozen: boolean,
): MatcherResult {
    requireExtension(name, 'response');
    const filePath = resolve(accessor.testDir, GROUND_EXPECTED, name);

    if (shouldUpdateSnapshots() && !frozen) {
        const previous = existsSync(filePath)
            ? parseResponseFile(readFileSync(filePath, 'utf8'), `${GROUND_EXPECTED}/${name}`)
            : null;

        const updated = buildUpdatedResponse(previous, accessor, accessor.captures.workdir);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, serializeResponseFile(updated));
        return PASS(`updated ${GROUND_EXPECTED}/${name}`);
    }

    if (!existsSync(filePath)) {
        return FAIL(
            `Response fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    const expected = parseResponseFile(
        readFileSync(filePath, 'utf8'),
        `${GROUND_EXPECTED}/${name}`,
    );
    const failure = compareResponse(name, expected, accessor, accessor.captures);
    return failure === null
        ? PASS(`expected response not to match ${GROUND_EXPECTED}/${name}`)
        : FAIL(failure);
}

// ── toMatch — async subjects (disk walk) ──

async function matchTreeFile(
    actualRoot: string,
    testDir: string,
    name: string,
    scope: CaptureScope,
    frozen: boolean,
): Promise<MatcherResult> {
    const fixtureDir = resolve(testDir, GROUND_EXPECTED, name);

    if (shouldUpdateSnapshots() && !frozen) {
        // Preserve placeholder-covered file contents from the previous
        // Fixture (CONVENTIONS D5) — everything else comes from the actual
        // Tree.
        const previousContents = new Map<string, string>();
        if (existsSync(fixtureDir)) {
            for (const file of await walkDirectory(fixtureDir)) {
                previousContents.set(file, readFileSync(resolve(fixtureDir, file), 'utf8'));
            }
        }
        rmSync(fixtureDir, { force: true, recursive: true });
        mkdirSync(fixtureDir, { recursive: true });
        cpSync(actualRoot, fixtureDir, { recursive: true });
        for (const file of await walkDirectory(fixtureDir)) {
            const previous = previousContents.get(file) ?? null;
            const actual = readFileSync(resolve(fixtureDir, file), 'utf8');
            const merged = mergeTextPreservingPlaceholders(previous, actual, scope);
            if (merged !== actual) {
                writeFileSync(resolve(fixtureDir, file), merged);
            }
        }
        return PASS(`updated ${GROUND_EXPECTED}/${name}/`);
    }

    if (!existsSync(fixtureDir)) {
        return FAIL(
            `Directory fixture "${name}" does not exist at ${fixtureDir}.\n${missingHint(frozen)}`,
        );
    }

    const diff = await diffDirectories(fixtureDir, actualRoot, { scope });
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
        return PASS(`expected directory not to match ${GROUND_EXPECTED}/${name}/`);
    }

    return FAIL(formatDirectoryDiff(name, diff, 'Run with TEST_UPDATE=1 to update the fixture.'));
}

// ── Matcher entry points ──

/**
 * Guard the accessor `toMatch` subjects: their argument is a fixture NAME, never
 * a regex or other value. A `RegExp` (the natural instinct, since vitest-native
 * `toMatch` takes one) must fail loudly with the escape hatch, not silently trip
 * the extension check or be coerced to `"/re/"`.
 */
function requireFixtureName(name: unknown, subjectKind: string): asserts name is string {
    if (typeof name !== 'string') {
        const got = name instanceof RegExp ? 'a regular expression' : `a ${typeof name}`;
        throw new TypeError(
            `toMatch on accessors takes a fixture name (extension included) — the ${subjectKind} subject received ${got}. ` +
                'For a regex, assert on the raw text instead: use expect(x.text).toMatch(/re/) for regex matching.',
        );
    }
}

function toMatch(
    received: unknown,
    expected: unknown,
    options?: MatchFixtureOptions,
): MatcherResult | Promise<MatcherResult> {
    const frozen = options?.frozen === true;
    if (received instanceof TextAccessor) {
        requireFixtureName(expected, 'stream');
        return matchStreamFile(received, expected, frozen);
    }
    if (received instanceof JsonAccessor) {
        requireFixtureName(expected, 'json');
        return matchJsonFile(received, expected, frozen);
    }
    if (received instanceof ResponseAccessor) {
        requireFixtureName(expected, 'response');
        return matchResponseFile(received, expected, frozen);
    }
    if (received instanceof FilesystemAccessor) {
        requireFixtureName(expected, 'filesystem');
        return matchTreeFile(received.cwd, received.testDir, expected, received.captures, frozen);
    }
    if (received instanceof DirectoryAccessor) {
        requireFixtureName(expected, 'directory');
        return matchTreeFile(received.root, received.testDir, expected, received.captures, frozen);
    }

    return nativeMatch(received, expected);
}

function toContain(received: unknown, expected: unknown): MatcherResult {
    if (received instanceof TextAccessor) {
        return textContains(received, String(expected));
    }
    return nativeContain(received, expected);
}

/** The one argument shape `toMatchRows` reads: a column list, and cells per row. */
type RowsExpectation = { columns: string[]; rows: readonly (readonly unknown[])[] };

/** Is this the shape, before the adapter is asked to build SQL from it? */
function isRowsExpectation(expected: unknown): expected is RowsExpectation {
    if (expected === null || typeof expected !== 'object') {
        return false;
    }
    const { columns, rows } = expected as Partial<RowsExpectation>;
    return Array.isArray(columns) && Array.isArray(rows);
}

async function toMatchRows(received: unknown, expected: unknown): Promise<MatcherResult> {
    if (!(received instanceof TableAccessor)) {
        throw new TypeError('toMatchRows: unsupported subject — expected result.table(...).');
    }
    // The shape is stated before the query runs: an absent `columns` reaching
    // The adapter surfaces as a TypeError from inside SQL generation, which
    // Names neither the matcher nor what it wanted.
    if (!isRowsExpectation(expected)) {
        throw new TypeError(
            'toMatchRows takes { columns, rows } — a column list and one array of cells per row ' +
                `(received ${Array.isArray(expected) ? 'an array' : `a ${typeof expected}`}).`,
        );
    }

    const actual = await received.query(expected.columns);
    const pass =
        actual.length === expected.rows.length &&
        expected.rows.every((row, i) => {
            const actualRow = actual[i];
            return (
                actualRow !== undefined &&
                row.length === actualRow.length &&
                row.every((cell, j) => structuralEquals(cell, actualRow[j], received.captures))
            );
        });

    return {
        message: () =>
            pass
                ? `expected table "${received.name}" not to match the given rows`
                : formatTableDiff(
                      received.name,
                      expected.columns,
                      expected.rows.map((row) => row.map((cell) => renderExpected(cell))),
                      actual,
                  ),
        pass,
    };
}

async function toBeEmpty(received: unknown): Promise<MatcherResult> {
    if (received instanceof TextAccessor) {
        return textIsEmpty(received);
    }
    if (!(received instanceof TableAccessor)) {
        throw new TypeError(
            'toBeEmpty: unsupported subject — expected result.table(...) or a text accessor.',
        );
    }

    const rows = await received.query(['*']);
    const pass = rows.length === 0;
    return {
        message: () =>
            pass
                ? `expected table "${received.name}" not to be empty`
                : `Expected table "${received.name}" to be empty, but it has ${rows.length} row${rows.length === 1 ? '' : 's'}`,
        pass,
    };
}

async function toBeRunning(received: unknown): Promise<MatcherResult> {
    if (!(received instanceof ContainerAccessor)) {
        throw new TypeError(
            'toBeRunning: unsupported subject — expected a container accessor (result.container(...) or spec.docker(...)).',
        );
    }

    const pass = received.running;
    return {
        message: () => {
            if (pass) {
                return 'expected container not to be running';
            }
            if (received.exists) {
                return `Expected container to be running, but its status is "${received.status}"`;
            }
            return 'Expected container to be running, but it does not exist';
        },
        pass,
    };
}

// ── Registration ──

const REGISTERED = Symbol.for('@jterrazz/test:matchers-registered');

/**
 * Register the custom matchers with vitest's `expect`. Idempotent — safe to
 * call from every `specification.*` constructor. A missing vitest peer is
 * tolerated (the library can be imported outside a vitest run).
 */
export async function registerMatchers(): Promise<void> {
    const globals = globalThis as { [REGISTERED]?: boolean };
    if (globals[REGISTERED]) {
        return;
    }
    globals[REGISTERED] = true;

    try {
        const { expect } = await import('vitest');
        expect.extend({
            toBeEmpty,
            toBeRunning,
            toContain,
            toMatch,
            toMatchRows,
        });
    } catch {
        // No vitest peer available (library imported outside a test run).
        globals[REGISTERED] = false;
    }
}
