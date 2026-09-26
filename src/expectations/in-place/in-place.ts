import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

import { dedent } from '../../../lint/engine/project/dedent.js';
import { isFrameworkFrame, stackFrames } from '../../kernel/files/caller.js';
import type { StackFrame } from '../../kernel/files/caller.js';

/** Every rewrite of a file is laid on the source the run loaded. The file is written when the run ends: vitest frames a failure by reading the file on disk. */

export type CallSite = StackFrame;

type ArgumentSpan = { end: number; indent: string; start: number };

const TO_MATCH = /\btoMatch\s*\(/gu;

export function callSiteOf(stack: string): CallSite | undefined {
    return stackFrames(stack).find(
        ({ file }) => !file.includes(`${sep}node_modules${sep}`) && !isFrameworkFrame(file),
    );
}

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

function stringEnd(source: string, start: number): number {
    const quote = source[start];
    let index = start + 1;
    while (index < source.length && source[index] !== quote) {
        index += source[index] === '\\' ? 2 : 1;
    }
    return index + 1;
}

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

function escapeTemplate(text: string): string {
    return text
        .replaceAll('\\', String.raw`\\`)
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${');
}

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

export function renderValue(value: unknown, indent: string): string {
    const json = JSON.stringify(value, null, 4) ?? 'undefined';
    return json.split('\n').join(`\n${indent}`);
}

export function renderRows(rows: readonly (readonly unknown[])[], indent: string): string {
    if (rows.length === 0) {
        return '[]';
    }
    const lines = rows.map(
        (row) => `${indent}    [${row.map((cell) => JSON.stringify(cell) ?? 'null').join(', ')}],`,
    );
    return `[\n${lines.join('\n')}\n${indent}]`;
}

type Ledger = { edits: Map<number, { end: number; text: string }>; original: string };

const LEDGERS = new Map<string, Ledger>();

type Pending = { file: string; source: string };

let pendingFolder: (() => string | undefined) | null = null;

/** Read at each write: the folder is the project's, and one worker may serve several. */
export function deferRewritesTo(folder: (() => string | undefined) | null): void {
    pendingFolder = folder;
}

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

declare module 'vitest' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- a module augmentation MERGES only as an interface; a type alias redeclares the name and every member is lost
    interface ProvidedContext {
        /** Where update mode leaves each rewritten test source until the run ends. */
        inPlaceRewrites?: string;
    }
}
