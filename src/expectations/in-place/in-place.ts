import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

import { isRecord } from '../../../lint/kit/project/json-shape.js';
import { argumentSpans, closingOf } from '../../../lint/kit/project/source-scan.js';
import { isFrameworkFrame, stackFrames } from '../../chain/paths/caller.js';
import type { StackFrame } from '../../chain/paths/caller.js';
import { refusal } from '../../chain/refusals/refusal.js';
import { formatRewritten } from './formatter.js';

/** Every rewrite of a file is laid on the source the run loaded. The file is written when the run ends: vitest frames a failure by reading the file on disk. */

export type CallSite = StackFrame;

type ArgumentSpan = { end: number; indent: string; start: number };

const TO_MATCH = /\btoMatch\s*\(/gu;

export function callSiteOf(stack: string): CallSite | undefined {
    return stackFrames(stack).find(
        ({ file }) => !file.includes(`${sep}node_modules${sep}`) && !isFrameworkFrame(file),
    );
}

function lineStartOf(source: string, line: number): number {
    let offset = 0;
    for (let current = 1; current < line; current += 1) {
        offset = source.indexOf('\n', offset) + 1;
    }
    return offset;
}

/** The call a frame points at, by its name or its parenthesis, among the calls of its line; its value's span, trimmed. */
export function locateArgument(source: string, site: CallSite): ArgumentSpan | undefined {
    const lineStart = lineStartOf(source, site.line);
    const position = lineStart + site.column - 1;
    TO_MATCH.lastIndex = lineStart;
    for (const found of source.matchAll(TO_MATCH)) {
        // Stryker disable next-line EqualityOperator: a frame points at the name or its parenthesis, never past it
        if (found.index + 'toMatch'.length < position) {
            continue;
        }
        const open = found.index + found[0].length - 1;
        const [span = { end: open + 1, start: open + 1 }] = argumentSpans(
            source,
            open + 1,
            closingOf(source, open),
        );
        const line = source.slice(source.lastIndexOf('\n', found.index) + 1);
        return { ...span, indent: line.slice(0, line.length - line.trimStart().length) };
    }
    return undefined;
}

type Ledger = { edits: Map<number, { end: number; text: string }>; original: string };

const LEDGERS = new Map<string, Ledger>();

type Pending = { file: string; source: string };

const isPending = (value: unknown): value is Pending =>
    isRecord(value) && typeof value.file === 'string' && typeof value.source === 'string';

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
    // Stryker disable next-line StringLiteral: a digest in any encoding keeps two files' rewrites apart, and the round trip reads back every .json the folder holds
    const name = createHash('sha256').update(file).digest('hex');
    const pending: Pending = { file, source };
    writeFileSync(join(folder, `${name}.json`), JSON.stringify(pending));
}

export function writePendingRewrites(folder: string): void {
    if (!existsSync(folder)) {
        return;
    }
    const written: string[] = [];
    for (const name of readdirSync(folder).filter((entry) => entry.endsWith('.json'))) {
        // Stryker disable next-line StringLiteral: a Buffer parses as the same JSON
        const pending: unknown = JSON.parse(readFileSync(join(folder, name), 'utf8'));
        if (isPending(pending)) {
            writeFileSync(pending.file, pending.source);
            written.push(pending.file);
        }
    }
    rmSync(folder, { recursive: true });
    formatRewritten(written);
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
            refusal({
                fix: 'call `.toMatch(` on the expect() written at that line, not through an alias',
                found: `update mode: no toMatch( stands at ${site.file}:${site.line}:${site.column} — the value in place cannot be written`,
                read: 'docs/reference/tokens.md#a-value-written-in-place-is-rewritten-in-the-test',
                why: 'A value written in place is rewritten where its `toMatch(` stands.',
            }),
        );
    }
    ledger.edits.set(span.start, { end: span.end, text: render(span.indent) });
    let source = ledger.original;
    for (const [start, edit] of [...ledger.edits].toSorted(([a], [b]) => b - a)) {
        source = source.slice(0, start) + edit.text + source.slice(edit.end);
    }
    save(site.file, source, folder);
}

declare module 'vitest' {
    interface ProvidedContext {
        /** Where update mode leaves each rewritten test source until the run ends. */
        inPlaceRewrites?: string;
    }
}
