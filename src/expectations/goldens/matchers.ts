/** Registered on the first `specification.*` call, through a dynamic `import('vitest')`: the library never imports vitest at load. */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { resolveSpecPath } from '../../kernel/files/resolve.js';
import { isDiskDirectory, isDiskFile } from '../../kernel/files/spec-path.js';
import { refusal } from '../../kernel/refusals/refusal.js';
import { ContainerAccessor } from '../command/container.js';
import { diffDirectories, DirectoryAccessor, walkDirectory } from '../disk/directory.js';
import { FilesystemAccessor } from '../disk/filesystem.js';
import { parseResponseFile, serializeResponseFile } from '../http/http-file.js';
import type { ParsedResponseFile } from '../http/http-file.js';
import { ResponseAccessor } from '../http/response.js';
import {
    callSiteOf,
    deferRewritesTo,
    renderRows,
    renderText,
    renderValue,
    writeInPlace,
} from '../in-place/in-place.js';
import { missingHint, shouldUpdateSnapshots } from '../in-place/update.js';
import { pairRows } from '../table/rows.js';
import type { Rows } from '../table/rows.js';
import { TableAccessor } from '../table/table.js';
import { dedent } from '../text/dedent.js';
import { JsonAccessor } from '../text/json.js';
import { TextAccessor } from '../text/text.js';
import { CaptureScope } from '../tokens/match.js';
import {
    hasPlaceholders,
    mergePreservingPlaceholders,
    mergeTextPreservingPlaceholders,
    renderExpected,
    structuralEquals,
} from '../tokens/structural.js';
import { formatDirectoryDiff, formatResponseDiff, formatTableDiff } from './diff.js';
import type { MatchFixtureOptions, TableMatchOptions } from './match-options.js';
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
} from './text-assertions.js';
import type { ValueRoute, WholeCall } from './text-assertions.js';

type MatcherResult = {
    message: () => string;
    pass: boolean;
};

const passed = (label: string): MatcherResult => ({ message: () => label, pass: true });
const failed = (message: string): MatcherResult => ({ message: () => message, pass: false });

function formatJson(value: unknown): string {
    return `${JSON.stringify(value, null, 4)}\n`;
}

/** `null` for no file, or a whitespace-only one an author creates to be recorded. */
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
        // Update mode writes tokens, not values (`no-volatile-literal`).
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

type ActualResponse = {
    body: unknown;
    headers: Record<string, string>;
    status: number;
};

/** Headers are the intersection with the actual response, so a freshly updated fixture passes the next run. */
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
    const body =
        previous?.hasBody && hasBody
            ? mergePreservingPlaceholders(previous.body, actual.body, workdir)
            : mergePreservingPlaceholders(null, actual.body, workdir);

    return { body, hasBody, headers, status };
}

export function compareResponse(
    name: string,
    expected: ParsedResponseFile,
    actual: ActualResponse,
    scope: CaptureScope,
): null | string {
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

    // Subset semantics: only the headers the fixture lists are asserted.
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
    const filePath = resolveSpecPath('toMatch', name, accessor.testDir);

    if (shouldUpdateSnapshots() && !frozen) {
        const recorded = recordedGolden(filePath);
        const previous =
            recorded === null
                ? null
                : parseResponseFile(recorded, name, accessor.headers['content-type']);

        const updated = buildUpdatedResponse(previous, accessor, accessor.captures.workdir);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, serializeResponseFile(updated, accessor.headers['content-type']));
        return passed(`updated ${name}`);
    }

    if (!existsSync(filePath)) {
        return failed(
            `Response fixture "${name}" does not exist at ${filePath}.\n${missingHint(frozen)}`,
        );
    }

    const expected = parseResponseFile(
        readFileSync(filePath, 'utf8'),
        name,
        accessor.headers['content-type'],
    );
    const failure = compareResponse(name, expected, accessor, accessor.captures);
    return failure === null ? passed(`expected response not to match ${name}`) : failed(failure);
}

async function matchTreeFile(
    actualRoot: string,
    testDir: string,
    name: string,
    scope: CaptureScope,
    frozen: boolean,
): Promise<MatcherResult> {
    const fixtureDir = resolveSpecPath('toMatch', name, testDir);

    if (shouldUpdateSnapshots() && !frozen) {
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
            refusal('one-verb-per-meaning', {
                fix: 'compare a stream, a json or a response to its file; a directory or the working directory is `await toMatch(directory(…))`',
                found: `toMatch(file(${JSON.stringify(expected.path)})) on a subject that holds no file of its kind`,
            }),
        );
    }
    if (isDiskDirectory(expected)) {
        return matchDirectoryGolden(received, expected.path, frozen);
    }
    throw new TypeError(
        refusal('one-verb-per-meaning', {
            fix: 'name the golden with file(…) or directory(…)',
            found: `toMatch(${spelledValue(expected)}) routed to the golden comparison`,
        }),
    );
}

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
        refusal('one-verb-per-meaning', {
            fix: `compare result.filesystem or result.directory(…) to directory(${JSON.stringify(path)}); a text is compared to file(…)`,
            found: `toMatch(directory(${JSON.stringify(path)})) on a subject that is no tree`,
        }),
    );
}

function isRows(expected: unknown): expected is Rows {
    return Array.isArray(expected) && expected.every((row) => Array.isArray(row));
}

function rowsMismatch(
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

type InPlace = {
    negated: boolean;
    options: TableMatchOptions | undefined;
    stack: string;
};

const UNRECORDED =
    'nothing is written in place yet — run with TEST_UPDATE=1 (or vitest -u) and the actual value is written into the test.';

function unrecorded(expected: unknown): boolean {
    return typeof expected === 'string' && expected.trim() === '';
}

function recordsInPlace(context: InPlace): boolean {
    return shouldUpdateSnapshots() && context.options?.frozen !== true && !context.negated;
}

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

function matchStreamValue(
    accessor: TextAccessor,
    expected: string,
    context: InPlace,
): MatcherResult {
    const comparison = compareStreamInPlace(accessor, expected);
    if (comparison.pass || !recordsInPlace(context)) {
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

function matchResponseValue(
    accessor: ResponseAccessor,
    expected: string,
    context: InPlace,
): MatcherResult {
    const previous = unrecorded(expected)
        ? null
        : parseResponseFile(dedent(expected), IN_PLACE, accessor.headers['content-type']);
    const failure =
        previous === null
            ? `Response (${IN_PLACE}): ${UNRECORDED}`
            : compareResponse(IN_PLACE, previous, accessor, accessor.captures);
    if (failure === null) {
        return passed('expected response not to match the value in place');
    }
    if (!recordsInPlace(context)) {
        return failed(failure);
    }
    const updated = buildUpdatedResponse(previous, accessor, accessor.captures.workdir);
    return writeAt(context, (indent) =>
        renderText(serializeResponseFile(updated, accessor.headers['content-type']), indent),
    );
}

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
    if (!recordsInPlace(context)) {
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
    if (!recordsInPlace(context)) {
        return failed(mismatch);
    }
    const merged = mergeRows(previous, rows, ordered);
    return writeAt(context, (indent) => renderRows(merged, indent));
}

function tableExpectation(expected: unknown): '' | Rows | undefined {
    if (isRows(expected)) {
        return expected;
    }
    return unrecorded(expected) ? '' : undefined;
}

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

function noValueRefusal(expected: unknown): TypeError {
    return new TypeError(
        refusal('one-verb-per-meaning', {
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
            refusal('one-verb-per-meaning', {
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

function spelledValue(value: unknown): string {
    if (value instanceof RegExp) {
        return 'a RegExp';
    }
    return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}

function routeValue(subject: unknown, value: unknown): ValueRoute {
    const stream = streamValueRoute(subject, value);
    if (stream !== undefined) {
        return stream;
    }
    if (subject instanceof ResponseAccessor) {
        return typeof value === 'string'
            ? 'whole'
            : new TypeError(
                  refusal('one-verb-per-meaning', {
                      fix: 'write the whole response in place, ``toMatch(`HTTP/1.1 200 OK …`)``, or compare it to toMatch(file(…))',
                      found: `toMatch(${spelledValue(value)}) on a response`,
                  }),
              );
    }
    if (subject instanceof JsonAccessor) {
        return value instanceof RegExp
            ? new TypeError(
                  refusal('one-verb-per-meaning', {
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
                  refusal('one-verb-per-meaning', {
                      fix: "write its rows in place, one array of cells per row in the table's column order: `await expect(result.table('<name>')).toMatch([[…]])`",
                      found: `toMatch(${spelledValue(value)}) on a table`,
                  }),
              );
    }
    if (subject instanceof DirectoryAccessor || subject instanceof FilesystemAccessor) {
        return new TypeError(
            refusal('one-verb-per-meaning', {
                fix: 'compare it to its golden tree: `await expect(…).toMatch(directory(…))`',
                found: `toMatch(${spelledValue(value)}) on a directory`,
            }),
        );
    }
    if (subject instanceof ContainerAccessor) {
        return new TypeError(
            refusal('one-verb-per-meaning', {
                fix: 'assert its state, `await expect(…).toBeRunning()`, or compare its logs, `result.container(…).stdout`, whole',
                found: `toMatch(${spelledValue(value)}) on a container`,
            }),
        );
    }
    return undefined;
}

const REGISTERED = Symbol.for('@jterrazz/test:matchers-registered');

/** Idempotent; a missing vitest peer is tolerated. */
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
        globals[REGISTERED] = false;
    }
}
