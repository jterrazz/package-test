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

import { missingHint, shouldUpdateSnapshots } from '../../runner/update.js';
import { ContainerAccessor } from '../../seams/docker/container-accessor.js';
import { formatDirectoryDiff, formatResponseDiff, formatTableDiff } from '../chain/reporter.js';
import { resolveSpecPath } from '../chain/resolve.js';
import { isDiskDirectory, isDiskFile } from '../chain/spec-path.js';
import { parseResponseFile, serializeResponseFile } from '../http-files/http-file.js';
import type { ParsedResponseFile } from '../http-files/http-file.js';
import { refusal } from '../lesson/refusal.js';
import { dedent } from '../matching/dedent.js';
import { CaptureScope } from '../matching/match.js';
import {
    hasPlaceholders,
    mergePreservingPlaceholders,
    mergeTextPreservingPlaceholders,
    renderExpected,
    structuralEquals,
} from '../matching/structural.js';
import { diffDirectories, DirectoryAccessor, walkDirectory } from '../result/directory.js';
import { FilesystemAccessor } from '../result/filesystem.js';
import { JsonAccessor } from '../result/json.js';
import type { MatchFixtureOptions, TableMatchOptions } from '../result/match-options.js';
import { ResponseAccessor } from '../result/response.js';
import { TableAccessor } from '../result/table.js';
import {
    compareStreamInPlace,
    compareStreamText,
    emptyStreamRefusal,
    GOLDEN_MATCHER,
    IN_PLACE,
    matchThroughGolden,
    requireExtension,
    streamValueRoute,
    WHOLE_MATCHER,
} from '../result/text-assertions.js';
import type { ValueRoute, WholeCall } from '../result/text-assertions.js';
import { TextAccessor } from '../result/text.js';
import {
    callSiteOf,
    deferRewritesTo,
    renderRows,
    renderText,
    renderValue,
    writeInPlace,
} from './in-place.js';
import { pairRows } from './rows.js';
import type { Rows } from './rows.js';

type MatcherResult = {
    message: () => string;
    pass: boolean;
};

const passed = (label: string): MatcherResult => ({ message: () => label, pass: true });
const failed = (message: string): MatcherResult => ({ message: () => message, pass: false });

function formatJson(value: unknown): string {
    return `${JSON.stringify(value, null, 4)}\n`;
}

// ── toMatch(file()) — sync subjects ──

/**
 * What an update run merges into: the golden's content, or `null` when there is
 * none to keep — no file, or a file holding only whitespace, the one an author
 * creates to be recorded.
 */
function recordedGolden(filePath: string): null | string {
    if (!existsSync(filePath)) {
        return null;
    }
    const content = readFileSync(filePath, 'utf8');
    return content.trim() === '' ? null : content;
}

function matchStreamFile(accessor: TextAccessor, name: string, frozen: boolean): MatcherResult {
    requireExtension(name, 'stream');
    const filePath = resolveSpecPath('toMatch', name, accessor.testDir);
    const actual = accessor.text;

    if (shouldUpdateSnapshots() && !frozen) {
        // Update mode writes TOKENS, not values: placeholder-covered lines of
        // The previous fixture are preserved, and values the framework knows
        // To be dynamic ({{workdir}}) are substituted (CONVENTIONS D5).
        const merged = mergeTextPreservingPlaceholders(
            recordedGolden(filePath),
            actual,
            accessor.captures,
        );
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, merged);
        return passed(`updated ${name}`);
    }

    if (!existsSync(filePath)) {
        return failed(
            `${accessor.streamName} fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    return compareStreamText(accessor, name, readFileSync(filePath, 'utf8'));
}

function matchJsonFile(accessor: JsonAccessor, name: string, frozen: boolean): MatcherResult {
    requireExtension(name, 'json');
    const filePath = resolveSpecPath('toMatch', name, accessor.testDir);
    const actual = accessor.value;

    if (shouldUpdateSnapshots() && !frozen) {
        // Writes TOKENS, not values — parity with the text path: preserve
        // Still-matching placeholders and substitute the known cwd back to
        // {{workdir}} (CONVENTIONS D5).
        const previous = recordedGolden(filePath);
        const merged = mergePreservingPlaceholders(
            previous === null ? null : JSON.parse(previous),
            actual,
            accessor.captures.workdir,
        );
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, formatJson(merged));
        return passed(`updated ${name}`);
    }

    if (!existsSync(filePath)) {
        return failed(
            `JSON fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    const expected = JSON.parse(readFileSync(filePath, 'utf8'));
    if (structuralEquals(expected, actual, accessor.captures)) {
        return passed(`expected JSON not to match ${name}`);
    }
    return failed(formatResponseDiff(name, renderExpected(expected), actual));
}

/** The parts of a response a fixture is checked against. */
type ActualResponse = {
    body: unknown;
    /** Flat, lower-cased key-value map. */
    headers: Record<string, string>;
    status: number;
};

/**
 * Build the updated `.http` golden content from the previous
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
 * Compare a parsed `.http` golden against an actual response.
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

/**
 * `toMatch(file('./expected/<name>.http'))` on a response — the golden, its
 * update included. A document's `response: ./expected/…` is this same call.
 */
export function matchResponseFile(
    accessor: ResponseAccessor,
    name: string,
    frozen: boolean,
): MatcherResult {
    requireExtension(name, 'response');
    const filePath = resolveSpecPath('toMatch', name, accessor.testDir);

    if (shouldUpdateSnapshots() && !frozen) {
        const recorded = recordedGolden(filePath);
        const previous = recorded === null ? null : parseResponseFile(recorded, name);

        const updated = buildUpdatedResponse(previous, accessor, accessor.captures.workdir);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, serializeResponseFile(updated));
        return passed(`updated ${name}`);
    }

    if (!existsSync(filePath)) {
        return failed(
            `Response fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    const expected = parseResponseFile(readFileSync(filePath, 'utf8'), name);
    const failure = compareResponse(name, expected, accessor, accessor.captures);
    return failure === null ? passed(`expected response not to match ${name}`) : failed(failure);
}

// ── toMatch(directory()) — async subjects (disk walk) ──

async function matchTreeFile(
    actualRoot: string,
    testDir: string,
    name: string,
    scope: CaptureScope,
    frozen: boolean,
): Promise<MatcherResult> {
    const fixtureDir = resolveSpecPath('toMatch', name, testDir);

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
        return passed(`updated ${name}`);
    }

    if (!existsSync(fixtureDir)) {
        return failed(
            `Directory fixture "${name}" does not exist at ${fixtureDir}.\n${missingHint(frozen)}`,
        );
    }

    const diff = await diffDirectories(fixtureDir, actualRoot, { scope });
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
        return passed(`expected directory not to match ${name}`);
    }

    return failed(formatDirectoryDiff(name, diff, 'Run with TEST_UPDATE=1 to update the fixture.'));
}

// ── Matcher entry points ──

/**
 * `toMatch(file())` / `toMatch(directory())` — the golden comparison. A file
 * golden is sync on a stream, json or response subject; a directory golden is
 * async, the tree compared on disk.
 */
function toMatchGolden(
    received: unknown,
    expected: unknown,
    options?: MatchFixtureOptions,
): MatcherResult | Promise<MatcherResult> {
    const frozen = options?.frozen === true;
    if (isDiskFile(expected)) {
        if (received instanceof TextAccessor) {
            return matchStreamFile(received, expected.path, frozen);
        }
        if (received instanceof JsonAccessor) {
            return matchJsonFile(received, expected.path, frozen);
        }
        if (received instanceof ResponseAccessor) {
            return matchResponseFile(received, expected.path, frozen);
        }
        throw new TypeError(
            refusal('d14-one-verb-per-meaning', {
                fix: 'compare a stream, a json or a response to its file; a directory or the working directory is `await toMatch(directory(…))`',
                found: `toMatch(file(${JSON.stringify(expected.path)})) on a subject that holds no file of its kind`,
            }),
        );
    }
    if (isDiskDirectory(expected)) {
        return matchDirectoryGolden(received, expected.path, frozen);
    }
    throw new TypeError(
        refusal('d14-one-verb-per-meaning', {
            fix: 'name the golden with file(…) or directory(…)',
            found: `toMatch(${spelledValue(expected)}) routed to the golden comparison`,
        }),
    );
}

/** `toMatch(directory())` — async, its refusal included: a tree golden is awaited. */
async function matchDirectoryGolden(
    received: unknown,
    path: string,
    frozen: boolean,
): Promise<MatcherResult> {
    if (received instanceof FilesystemAccessor) {
        return await matchTreeFile(received.cwd, received.testDir, path, received.captures, frozen);
    }
    if (received instanceof DirectoryAccessor) {
        return await matchTreeFile(
            received.root,
            received.testDir,
            path,
            received.captures,
            frozen,
        );
    }
    throw new TypeError(
        refusal('d14-one-verb-per-meaning', {
            fix: `compare result.filesystem or result.directory(…) to directory(${JSON.stringify(path)}); a text is compared to file(…)`,
            found: `toMatch(directory(${JSON.stringify(path)})) on a subject that is no tree`,
        }),
    );
}

/** Is this rows, before the table is queried against it? */
function isRows(expected: unknown): expected is Rows {
    return Array.isArray(expected) && expected.every((row) => Array.isArray(row));
}

/**
 * Compare the rows a table holds against the rows stated — as a multiset, or
 * in the table's order when `ordered` — the diff when they differ, `null`
 * when they match.
 */
export function rowsMismatch(
    name: string,
    expected: { columns: string[]; rows: Rows },
    actual: unknown[][],
    { ordered, scope }: { ordered: boolean; scope: CaptureScope },
): null | string {
    const { pairs, pass } = pairRows(expected.rows, actual, scope, ordered);
    return pass
        ? null
        : formatTableDiff(
              name,
              expected.columns,
              pairs.map(({ actual: row, expected: stated, matched }) => ({
                  actual: row,
                  expected: stated?.map((cell) => renderExpected(cell)),
                  matched,
              })),
          );
}

// ── toMatch(<value>) — the whole result against the value written in place ──

/** What a whole-result comparison is handed besides its value: its options, and its call site's stack. */
type InPlace = {
    /** A negation asserts a mismatch, and update mode never records one. */
    negated: boolean;
    options: TableMatchOptions | undefined;
    stack: string;
};

/** The hint an expectation not yet written in place gives: the run that writes it. */
const UNRECORDED =
    'nothing is written in place yet — run with TEST_UPDATE=1 (or vitest -u) and the actual value is written into the test.';

/** Nothing written in place yet: the empty text an author leaves to be recorded. */
function unrecorded(expected: unknown): boolean {
    return typeof expected === 'string' && expected.trim() === '';
}

/** Does this comparison write its value in place instead of failing? */
function recording(context: InPlace): boolean {
    return shouldUpdateSnapshots() && context.options?.frozen !== true && !context.negated;
}

/** Write what `render` states over the value in place at the call the stack names. */
function writeAt(context: InPlace, render: (indent: string) => string): MatcherResult {
    const site = callSiteOf(context.stack);
    if (site === undefined) {
        throw new Error(
            'update mode: no frame of this toMatch call is a test file — the value in place has nowhere to be written.',
        );
    }
    writeInPlace(site, render);
    return passed(`updated the value in place at ${site.file}:${site.line}`);
}

/** A stream against its text written in place; recorded, the lines whose tokens still match keep them. */
function matchStreamValue(
    accessor: TextAccessor,
    expected: string,
    context: InPlace,
): MatcherResult {
    const comparison = compareStreamInPlace(accessor, expected);
    if (comparison.pass || !recording(context)) {
        return comparison;
    }
    const previous = dedent(expected);
    const merged = mergeTextPreservingPlaceholders(
        previous === '' ? null : previous,
        accessor.text,
        accessor.captures,
    );
    return writeAt(context, (indent) => renderText(merged, indent));
}

/** A response against its `.http` text written in place: status, the headers it lists, the body. */
function matchResponseValue(
    accessor: ResponseAccessor,
    expected: string,
    context: InPlace,
): MatcherResult {
    const previous = unrecorded(expected) ? null : parseResponseFile(dedent(expected), IN_PLACE);
    const failure =
        previous === null
            ? `Response (${IN_PLACE}): ${UNRECORDED}`
            : compareResponse(IN_PLACE, previous, accessor, accessor.captures);
    if (failure === null) {
        return passed('expected response not to match the value in place');
    }
    if (!recording(context)) {
        return failed(failure);
    }
    const updated = buildUpdatedResponse(previous, accessor, accessor.captures.workdir);
    return writeAt(context, (indent) => renderText(serializeResponseFile(updated), indent));
}

/** A json against the value written in place, tokens and `match.*` included. */
function matchJsonValue(
    accessor: JsonAccessor,
    expected: unknown,
    context: InPlace,
): MatcherResult {
    const actual = accessor.value;
    const empty = unrecorded(expected);
    if (!empty && structuralEquals(expected, actual, accessor.captures)) {
        return passed('expected JSON not to match the value in place');
    }
    if (!recording(context)) {
        return failed(
            empty
                ? `JSON (${IN_PLACE}): ${UNRECORDED}`
                : formatResponseDiff(IN_PLACE, renderExpected(expected), actual),
        );
    }
    const merged = mergePreservingPlaceholders(
        empty ? null : renderExpected(expected),
        actual,
        accessor.captures.workdir,
    );
    return writeAt(context, (indent) => renderValue(merged, indent));
}

/**
 * Rows to write in place, in the order the previous rows stated them and the
 * rows no previous row paired after: each cell whose previous expectation, as
 * a token, still matches keeps the token; every other cell is the table's value.
 */
function mergeRows(previous: null | Rows, actual: unknown[][], ordered: boolean): unknown[][] {
    const pairs =
        previous === null
            ? actual.map((row) => ({ actual: row, expected: undefined }))
            : pairRows(previous, actual, new CaptureScope(), ordered).pairs;
    return pairs.flatMap(({ actual: row, expected }) =>
        row === undefined
            ? []
            : [
                  row.map((cell, index) => {
                      const before = renderExpected(expected?.[index]);
                      return typeof before === 'string' &&
                          hasPlaceholders(before) &&
                          structuralEquals(before, cell, new CaptureScope())
                          ? before
                          : cell;
                  }),
              ],
    );
}

/** A table against its rows written in place: every column, in the table's order. */
async function matchTableValue(
    accessor: TableAccessor,
    expected: '' | Rows,
    context: InPlace,
): Promise<MatcherResult> {
    const { columns, rows } = await accessor.content();
    const previous = isRows(expected) ? expected : null;
    const ordered = context.options?.ordered === true;
    const mismatch =
        previous === null
            ? `Table "${accessor.name}" (${IN_PLACE}): ${UNRECORDED}`
            : rowsMismatch(accessor.name, { columns, rows: previous }, rows, {
                  ordered,
                  scope: accessor.captures,
              });
    if (mismatch === null) {
        return passed(`expected table "${accessor.name}" not to match the rows in place`);
    }
    if (!recording(context)) {
        return failed(mismatch);
    }
    const merged = mergeRows(previous, rows, ordered);
    return writeAt(context, (indent) => renderRows(merged, indent));
}

/** The value a table is compared to: its rows, or nothing recorded yet. */
function tableExpectation(expected: unknown): '' | Rows | undefined {
    if (isRows(expected)) {
        return expected;
    }
    return unrecorded(expected) ? '' : undefined;
}

/**
 * `toMatch(<value>)` on a result subject — the whole result against the value
 * the test writes in place, rewritten there by update mode. The route has
 * already refused a value the subject cannot be compared to.
 */
function toMatchWhole(
    this: { isNot?: boolean },
    received: unknown,
    expected: unknown,
    call?: WholeCall,
): MatcherResult | Promise<MatcherResult> {
    const context: InPlace = {
        negated: this.isNot === true,
        options: call?.options,
        stack: call?.stack ?? '',
    };
    if (received instanceof JsonAccessor) {
        return matchJsonValue(received, expected, context);
    }
    const table = received instanceof TableAccessor ? tableExpectation(expected) : undefined;
    if (received instanceof TableAccessor && table !== undefined) {
        return matchTableValue(received, table, context);
    }
    if (typeof expected !== 'string') {
        throw noValueRefusal(expected);
    }
    if (received instanceof ResponseAccessor) {
        return matchResponseValue(received, expected, context);
    }
    if (received instanceof TextAccessor) {
        return matchStreamValue(received, expected, context);
    }
    throw noValueRefusal(expected);
}

/** A subject the value route has no comparison for. */
function noValueRefusal(expected: unknown): TypeError {
    return new TypeError(
        refusal('d14-one-verb-per-meaning', {
            fix: 'compare it to its golden, `toMatch(file(…))`, or assert a part of its text with vitest on `.text`',
            found: `toMatch(${spelledValue(expected)}) on a subject that is not compared to a value written in place`,
        }),
    );
}

async function toBeEmpty(received: unknown): Promise<MatcherResult> {
    if (received instanceof TextAccessor) {
        throw emptyStreamRefusal(received);
    }
    if (!(received instanceof TableAccessor)) {
        throw new TypeError(
            refusal('d14-one-verb-per-meaning', {
                fix: "assert a table empty, `await expect(result.table('<name>')).toBeEmpty()`; any other subject is compared whole with toMatch",
                found: 'toBeEmpty() on a subject that is no table',
            }),
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

/** How the refusal spells a value it was handed. */
function spelledValue(value: unknown): string {
    if (value instanceof RegExp) {
        return 'a RegExp';
    }
    return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}

/**
 * How a value handed to `toMatch` is read, per subject: a result the framework
 * produced is compared WHOLE to the value written in place — its `.http` text
 * for a response, the value for a json, the rows for a table, the text for a
 * stream — and one that takes no value is refused naming what it takes. A
 * subject that is none of them is vitest's.
 */
function routeValue(subject: unknown, value: unknown): ValueRoute {
    const stream = streamValueRoute(subject, value);
    if (stream !== undefined) {
        return stream;
    }
    if (subject instanceof ResponseAccessor) {
        return typeof value === 'string'
            ? 'whole'
            : new TypeError(
                  refusal('d14-one-verb-per-meaning', {
                      fix: 'write the whole response in place, ``toMatch(`HTTP/1.1 200 OK …`)``, or compare it to toMatch(file(…))',
                      found: `toMatch(${spelledValue(value)}) on a response`,
                  }),
              );
    }
    if (subject instanceof JsonAccessor) {
        return value instanceof RegExp
            ? new TypeError(
                  refusal('d14-one-verb-per-meaning', {
                      fix: 'write the whole value in place, `toMatch({ … })`, or compare it to toMatch(file(…))',
                      found: 'toMatch(a RegExp) on a json',
                  }),
              )
            : 'whole';
    }
    if (subject instanceof TableAccessor) {
        return isRows(value) || unrecorded(value)
            ? 'whole'
            : new TypeError(
                  refusal('d14-one-verb-per-meaning', {
                      fix: "write its rows in place, one array of cells per row in the table's column order: `await expect(result.table('<name>')).toMatch([[…]])`",
                      found: `toMatch(${spelledValue(value)}) on a table`,
                  }),
              );
    }
    if (subject instanceof DirectoryAccessor || subject instanceof FilesystemAccessor) {
        return new TypeError(
            refusal('d14-one-verb-per-meaning', {
                fix: 'compare it to its golden tree: `await expect(…).toMatch(directory(…))`',
                found: `toMatch(${spelledValue(value)}) on a directory`,
            }),
        );
    }
    if (subject instanceof ContainerAccessor) {
        return new TypeError(
            refusal('d14-one-verb-per-meaning', {
                fix: 'assert its state, `await expect(…).toBeRunning()`, or compare its logs, `result.container(…).stdout`, whole',
                found: `toMatch(${spelledValue(value)}) on a container`,
            }),
        );
    }
    return undefined;
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
        const { chai, expect, inject } = await import('vitest');
        deferRewritesTo(() => inject('inPlaceRewrites'));
        expect.extend({
            [GOLDEN_MATCHER]: toMatchGolden,
            [WHOLE_MATCHER]: toMatchWhole,
            toBeEmpty,
            toBeRunning,
        });
        matchThroughGolden(chai, routeValue);
    } catch {
        // No vitest peer available (library imported outside a test run).
        globals[REGISTERED] = false;
    }
}
