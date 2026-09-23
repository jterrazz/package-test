import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isFrameworkFrame } from '../chain/caller.js';
import { dedent } from '../matching/dedent.js';

/**
 * Update mode, for a value written in place: the test's own source rewritten
 * where its `toMatch(<value>)` stands — the gesture vitest's inline snapshots
 * make, over the argument of the framework's one comparing verb.
 *
 * The call is found from the stack the matcher was handed, then read in the
 * source the run loaded: every rewrite of one file during a run is laid on
 * that same original text, so a second rewrite lands where its stack says
 * even after a first one moved the lines below it.
 *
 * Under the preset the test file itself is written when the run ENDS: vitest
 * prints a failure's code frame by reading the file on disk at the line the
 * run loaded, so a file rewritten mid-run would frame a later failure at
 * another test's code. A worker writes the rewritten source to the run's
 * pending folder instead, and the global setup the preset registers writes
 * each pending source to its test file once the report is printed. With no
 * pending folder — a run outside the preset — the file is written at once.
 */

/** Where a `toMatch(<value>)` call stands in a test's source, 1-based. */
export type CallSite = { column: number; file: string; line: number };

/** The span a value written in place occupies, and the indentation of its line. */
type ArgumentSpan = { end: number; indent: string; start: number };

const FRAME = /\(?(?<file>(?:file:\/\/)?\/[^():]+):(?<line>\d+):(?<column>\d+)\)?$/u;

const TO_MATCH = /\btoMatch\s*\(/gu;

/** The first frame of a stack that is the test's own: never the framework's, never a dependency's. */
export function callSiteOf(stack: string): CallSite | undefined {
    for (const frame of stack.split('\n')) {
        const groups = FRAME.exec(frame.trim())?.groups;
        if (groups?.file === undefined) {
            continue;
        }
        const file = groups.file.startsWith('file://') ? fileURLToPath(groups.file) : groups.file;
        if (file.includes(`${sep}node_modules${sep}`) || isFrameworkFrame(file)) {
            continue;
        }
        return { column: Number(groups.column), file, line: Number(groups.line) };
    }
    return undefined;
}

/** The offset of a 1-based line and column in a source. */
function offsetOf(source: string, line: number, column: number): number {
    let offset = 0;
    for (let current = 1; current < line; current += 1) {
        const next = source.indexOf('\n', offset);
        if (next === -1) {
            return source.length;
        }
        offset = next + 1;
    }
    return offset + column - 1;
}

/** Past the quote closing the string that opens at `start`. */
function stringEnd(source: string, start: number): number {
    const quote = source[start];
    let index = start + 1;
    while (index < source.length && source[index] !== quote) {
        index += source[index] === '\\' ? 2 : 1;
    }
    return index + 1;
}

/** Past the `}` closing the brace that opens at `start`, strings and templates skipped. */
function braceEnd(source: string, start: number): number {
    let depth = 0;
    let index = start;
    while (index < source.length) {
        const character = source[index];
        if (character === '"' || character === "'") {
            index = stringEnd(source, index);
            continue;
        }
        if (character === '`') {
            index = templateEnd(source, index);
            continue;
        }
        if (character === '{') {
            depth += 1;
        } else if (character === '}') {
            depth -= 1;
            if (depth === 0) {
                return index + 1;
            }
        }
        index += 1;
    }
    return source.length;
}

/** Past the backtick closing the template that opens at `start`, its holes skipped. */
function templateEnd(source: string, start: number): number {
    let index = start + 1;
    while (index < source.length && source[index] !== '`') {
        if (source[index] === '\\') {
            index += 2;
        } else if (source[index] === '$' && source[index + 1] === '{') {
            index = braceEnd(source, index + 1);
        } else {
            index += 1;
        }
    }
    return index + 1;
}

/** Past what opens at `index` and must be skipped whole — a string, a template, a comment — or `index` itself. */
function skipped(source: string, index: number): number {
    const character = source[index];
    if (character === '"' || character === "'") {
        return stringEnd(source, index);
    }
    if (character === '`') {
        return templateEnd(source, index);
    }
    if (source.startsWith('//', index)) {
        const next = source.indexOf('\n', index);
        return next === -1 ? source.length : next;
    }
    return source.startsWith('/*', index) ? source.indexOf('*/', index) + 2 : index;
}

/** Where the argument opening at `start` ends: a `,` or the `)` at its own depth. */
function argumentEnd(source: string, start: number): number {
    let depth = 0;
    let index = start;
    while (index < source.length) {
        const past = skipped(source, index);
        if (past !== index) {
            index = past;
            continue;
        }
        const character = source[index] ?? '';
        const closes = ')]}'.includes(character);
        if ((closes && depth === 0) || (character === ',' && depth === 0)) {
            return index;
        }
        depth += '([{'.includes(character) ? 1 : closes ? -1 : 0;
        index += 1;
    }
    return source.length;
}

/**
 * The first argument of the `toMatch(` call the site points at: the one that
 * holds the site's position, or the first after it — a frame points at the
 * call's name, or at the `expect` a chain opens on.
 */
export function locateArgument(source: string, site: CallSite): ArgumentSpan | undefined {
    const lineStart = offsetOf(source, site.line, 1);
    const position = offsetOf(source, site.line, site.column);
    TO_MATCH.lastIndex = lineStart;
    for (const found of source.matchAll(TO_MATCH)) {
        if (found.index < lineStart || found.index + 'toMatch'.length < position) {
            continue;
        }
        let start = found.index + found[0].length;
        while (/\s/u.test(source[start] ?? '')) {
            start += 1;
        }
        const end = start + source.slice(start, argumentEnd(source, start)).trimEnd().length;
        const lineOfCall = source.lastIndexOf('\n', found.index) + 1;
        const indent = /^[\t ]*/u.exec(source.slice(lineOfCall))?.[0] ?? '';
        return { end, indent, start };
    }
    return undefined;
}

/** A template literal's body for `text`: every character it would read as syntax, escaped. */
function escapeTemplate(text: string): string {
    return text
        .replaceAll('\\', String.raw`\\`)
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${');
}

/**
 * A text as a template literal written at `indent`: a line alone, or a block
 * indented one level deeper than the call, read back by {@link dedent} as the
 * same text. A text no block can state — one whose every line is indented,
 * or whose last line is only spaces — is written as one quoted line.
 */
export function renderText(text: string, indent: string): string {
    if (!text.includes('\n')) {
        return `\`${escapeTemplate(text)}\``;
    }
    const inner = `${indent}    `;
    const lines = text.split('\n');
    const last = lines.pop() ?? '';
    const body = lines.map((line) => (line === '' ? '' : `${inner}${line}`)).join('\n');
    const block = `\n${body}\n${last === '' ? indent : `${inner}${last}`}`;
    return dedent(block) === text ? `\`${escapeTemplate(block)}\`` : JSON.stringify(text);
}

/** A JSON value as code written at `indent`: its JSON, each line after the first indented with the call. */
export function renderValue(value: unknown, indent: string): string {
    const json = JSON.stringify(value, null, 4) ?? 'undefined';
    return json.split('\n').join(`\n${indent}`);
}

/** Rows as code written at `indent`: one line per row. */
export function renderRows(rows: readonly (readonly unknown[])[], indent: string): string {
    if (rows.length === 0) {
        return '[]';
    }
    const lines = rows.map(
        (row) => `${indent}    [${row.map((cell) => JSON.stringify(cell) ?? 'null').join(', ')}],`,
    );
    return `[\n${lines.join('\n')}\n${indent}]`;
}

/** One test file's rewrites during a run: the source the run loaded, and each span rewritten. */
type Ledger = { edits: Map<number, { end: number; text: string }>; original: string };

const LEDGERS = new Map<string, Ledger>();

/** A test file's rewritten source, waiting in the pending folder for the run to end. */
type Pending = { file: string; source: string };

/** Where this run's rewrites wait, or `null` when they are written at once. */
let pendingFolder: (() => string | undefined) | null = null;

/**
 * Name where this run's rewrites wait until it ends — a function, read at
 * each write: the folder is the project's, and one worker may serve several.
 * `null` writes each rewrite at once.
 */
export function deferRewritesTo(folder: (() => string | undefined) | null): void {
    pendingFolder = folder;
}

/** Save `source` as `file`'s rewrite: into the pending `folder` when there is one, over the file otherwise. */
function save(file: string, source: string, folder: string | undefined): void {
    if (folder === undefined) {
        writeFileSync(file, source);
        return;
    }
    mkdirSync(folder, { recursive: true });
    const name = createHash('sha256').update(file).digest('hex').slice(0, 16);
    const pending: Pending = { file, source };
    writeFileSync(join(folder, `${name}.json`), JSON.stringify(pending));
}

/** Write every rewrite waiting in `folder` over its test file, then remove the folder. */
export function writePendingRewrites(folder: string): void {
    if (!existsSync(folder)) {
        return;
    }
    for (const name of readdirSync(folder).filter((entry) => entry.endsWith('.json'))) {
        const pending = JSON.parse(readFileSync(join(folder, name), 'utf8')) as Pending;
        writeFileSync(pending.file, pending.source);
    }
    rmSync(folder, { force: true, recursive: true });
}

/**
 * Write the value `render` states over the argument of the `toMatch(` call
 * standing at `site`, and save the test file's new source. Every rewrite of a file is laid
 * on the source the run loaded, so a line a first rewrite moved is still
 * found where the stack of the second one says.
 */
export function writeInPlace(
    site: CallSite,
    render: (indent: string) => string,
    folder: string | undefined = pendingFolder?.(),
): void {
    const ledger: Ledger = LEDGERS.get(site.file) ?? {
        edits: new Map(),
        original: readFileSync(site.file, 'utf8'),
    };
    LEDGERS.set(site.file, ledger);
    const span = locateArgument(ledger.original, site);
    if (span === undefined) {
        throw new Error(
            `update mode: no toMatch( stands at ${site.file}:${site.line}:${site.column} — the value in place cannot be written.`,
        );
    }
    ledger.edits.set(span.start, { end: span.end, text: render(span.indent) });
    let source = ledger.original;
    const starts = [...ledger.edits.keys()].toSorted((a, b) => b - a);
    for (const start of starts) {
        const edit = ledger.edits.get(start);
        if (edit !== undefined) {
            source = source.slice(0, start) + edit.text + source.slice(edit.end);
        }
    }
    save(site.file, source, folder);
}

/** Where the run's rewrites wait — what the preset's global setup provides to each project. */
declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** Where update mode leaves each rewritten test source until the run ends. */
        inPlaceRewrites?: string;
    }
}
