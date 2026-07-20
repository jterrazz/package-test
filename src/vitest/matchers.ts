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

import {
    type ParsedResponseFile,
    parseResponseFile,
    serializeResponseFile,
} from '../core/http-files/http-file.js';
import { CaptureScope } from '../core/matching/match.js';
import {
    mergePreservingPlaceholders,
    mergeTextPreservingPlaceholders,
    renderExpected,
    structuralEquals,
    textEquals,
} from '../core/matching/structural.js';
import {
    formatDirectoryDiff,
    formatResponseDiff,
    formatStdoutDiff,
    formatTableDiff,
} from '../core/specification/shared/reporter.js';
import {
    diffDirectories,
    DirectoryAccessor,
    walkDirectory,
} from '../core/specification/shared/result/directory.js';
import { FilesystemAccessor } from '../core/specification/shared/result/filesystem.js';
import { JsonAccessor } from '../core/specification/shared/result/json.js';
import { ResponseAccessor } from '../core/specification/shared/result/response.js';
import { TableAccessor } from '../core/specification/shared/result/table.js';
import { TextAccessor } from '../core/specification/shared/result/text.js';
import { ContainerAccessor } from '../integrations/docker/container-accessor.js';
import { shouldUpdateSnapshots, UPDATE_HINT } from './update.js';

interface MatcherResult {
    message: () => string;
    pass: boolean;
}

/**
 * Per-call options for the fixture-file `toMatch` subjects. `frozen` opts a
 * single fixture OUT of update-mode rewriting: a frozen fixture is NEVER
 * written under `TEST_UPDATE=1` (or vitest `-u`) — in update mode a frozen
 * mismatch still throws its diff, and a frozen missing fixture still throws its
 * "does not exist" error. This is what makes a DELIBERATELY-WRONG fixture (the
 * subject of a negative test that asserts the mismatch/error rendering)
 * survivable across update runs instead of being silently overwritten with the
 * actual output.
 */
export interface MatchFixtureOptions {
    frozen?: boolean;
}

const PASS = (label: string): MatcherResult => ({ message: () => label, pass: true });
const FAIL = (message: string): MatcherResult => ({ message: () => message, pass: false });

function requireExtension(name: string, subject: string): void {
    if (!/\.[A-Za-z0-9]+$/.test(name)) {
        throw new Error(
            `toMatch("${name}"): the extension is part of the name and is required for ${subject} subjects (e.g. "help.txt").`,
        );
    }
}

function formatJson(value: unknown): string {
    return `${JSON.stringify(value, null, 4)}\n`;
}

// ── toMatch — sync subjects ──

function matchStreamFile(accessor: TextAccessor, name: string, frozen: boolean): MatcherResult {
    requireExtension(name, 'stream');
    const filePath = resolve(accessor.testDir, 'expected', name);
    const actual = accessor.comparableText;

    if (shouldUpdateSnapshots() && !frozen) {
        // Update mode writes TOKENS, not values: placeholder-covered lines of
        // The previous fixture are preserved, and values the framework knows
        // To be dynamic ({{workdir}}) are substituted (CONVENTIONS D5).
        const previous = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
        const merged = mergeTextPreservingPlaceholders(previous, actual, accessor.captures);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, merged);
        return PASS(`updated expected/${name}`);
    }

    if (!existsSync(filePath)) {
        return FAIL(
            `${accessor.streamName} fixture "${name}" does not exist at ${filePath}.\n${UPDATE_HINT}`,
        );
    }

    // Text snapshots share the unified {{token}} grammar (CONVENTIONS D4).
    const expected = readFileSync(filePath, 'utf8');
    if (textEquals(expected, actual, accessor.captures)) {
        return PASS(`expected ${accessor.streamName} not to match expected/${name}`);
    }
    return FAIL(formatStdoutDiff(name, expected, actual));
}

function matchJsonFile(accessor: JsonAccessor, name: string, frozen: boolean): MatcherResult {
    requireExtension(name, 'json');
    const filePath = resolve(accessor.testDir, 'expected', name);
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
        return PASS(`updated expected/${name}`);
    }

    if (!existsSync(filePath)) {
        return FAIL(`JSON fixture "${name}" does not exist at ${filePath}.\n${UPDATE_HINT}`);
    }

    const expected = JSON.parse(readFileSync(filePath, 'utf8'));
    if (structuralEquals(expected, actual, accessor.captures)) {
        return PASS(`expected JSON not to match expected/${name}`);
    }
    return FAIL(formatResponseDiff(name, renderExpected(expected), actual));
}

/** The parts of a response a fixture is checked against. */
interface ActualResponse {
    body: unknown;
    /** Flat, lower-cased key-value map. */
    headers: Record<string, string>;
    status: number;
}

/**
 * Build the updated `expected/*.http` fixture content from the previous
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
 * Compare a parsed `expected/*.http` fixture against an actual response.
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
    const statusOk = /^\d+$/.test(expected.status)
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
    const filePath = resolve(accessor.testDir, 'expected', name);

    if (shouldUpdateSnapshots() && !frozen) {
        const previous = existsSync(filePath)
            ? parseResponseFile(readFileSync(filePath, 'utf8'), `expected/${name}`)
            : null;

        const updated = buildUpdatedResponse(previous, accessor, accessor.captures.workdir);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, serializeResponseFile(updated));
        return PASS(`updated expected/${name}`);
    }

    if (!existsSync(filePath)) {
        return FAIL(`Response fixture "${name}" does not exist at ${filePath}.\n${UPDATE_HINT}`);
    }

    const expected = parseResponseFile(readFileSync(filePath, 'utf8'), `expected/${name}`);
    const failure = compareResponse(name, expected, accessor, accessor.captures);
    return failure === null
        ? PASS(`expected response not to match expected/${name}`)
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
    const fixtureDir = resolve(testDir, 'expected', name);

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
        return PASS(`updated expected/${name}/`);
    }

    if (!existsSync(fixtureDir)) {
        return FAIL(`Directory fixture "${name}" does not exist at ${fixtureDir}.\n${UPDATE_HINT}`);
    }

    const diff = await diffDirectories(fixtureDir, actualRoot, { scope });
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
        return PASS(`expected directory not to match expected/${name}/`);
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

    // Delegate to vitest-native semantics for strings (substring or regexp).
    if (typeof received === 'string') {
        const pass =
            expected instanceof RegExp
                ? expected.test(received)
                : received.includes(String(expected));
        return {
            message: () =>
                `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to match ${String(expected)}`,
            pass,
        };
    }
    throw new TypeError(
        'toMatch: unsupported subject — expected a stream, json, response, filesystem, or directory accessor, or a string.',
    );
}

function toContain(received: unknown, expected: unknown): MatcherResult {
    if (received instanceof TextAccessor) {
        const actual = received.comparableText;
        const text = String(expected);
        const pass = actual.includes(text);
        return {
            message: () =>
                pass
                    ? `expected ${received.streamName} not to contain ${JSON.stringify(text)}`
                    : `${received.streamName} does not contain expected substring.\n` +
                      `  expected to contain: ${JSON.stringify(text)}\n` +
                      `  actual: ${JSON.stringify(actual.length > 500 ? `${actual.slice(0, 500)}…` : actual)}`,
            pass,
        };
    }

    // Delegate to vitest-native semantics for strings and iterables.
    if (typeof received === 'string') {
        const pass = received.includes(String(expected));
        return {
            message: () =>
                `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to contain ${JSON.stringify(expected)}`,
            pass,
        };
    }
    if (
        received != null &&
        typeof (received as Iterable<unknown>)[Symbol.iterator] === 'function'
    ) {
        const items = [...(received as Iterable<unknown>)];
        const pass = items.includes(expected);
        return {
            message: () =>
                `expected iterable ${pass ? 'not ' : ''}to contain ${JSON.stringify(expected)}`,
            pass,
        };
    }
    throw new TypeError(
        `toContain: unsupported subject of type ${typeof received} — expected a stream accessor, string, or iterable.`,
    );
}

async function toMatchRows(
    received: unknown,
    expected: { columns: string[]; rows: readonly (readonly unknown[])[] },
): Promise<MatcherResult> {
    if (!(received instanceof TableAccessor)) {
        throw new TypeError('toMatchRows: unsupported subject — expected result.table(...).');
    }

    const actual = await received.query(expected.columns);
    const pass =
        actual.length === expected.rows.length &&
        expected.rows.every(
            (row, i) =>
                row.length === actual[i].length &&
                row.every((cell, j) => structuralEquals(cell, actual[i][j], received.captures)),
        );

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
        const content = received.comparableText;
        const pass = content === '';
        return {
            message: () =>
                pass
                    ? `expected ${received.streamName} not to be empty`
                    : `Expected ${received.streamName} to be empty, but it contains:\n${content}`,
            pass,
        };
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
