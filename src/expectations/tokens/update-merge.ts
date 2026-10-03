import { CaptureScope } from './match.js';
import {
    hasPlaceholders,
    isPlainObject,
    placeholderStringMatches,
    textEquals,
} from './structural.js';

/** So a golden written under `TEST_UPDATE=1` stores the token, not a temp path (`no-volatile-literal`). */
function substituteWorkdirDeep(value: unknown, workdir: string): unknown {
    if (typeof value === 'string') {
        return value.replaceAll(workdir, '{{workdir}}');
    }
    if (Array.isArray(value)) {
        return value.map((item) => substituteWorkdirDeep(item, workdir));
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, substituteWorkdirDeep(item, workdir)]),
        );
    }
    return value;
}

export function mergePreservingPlaceholders(
    previous: unknown,
    actual: unknown,
    workdir?: string,
): unknown {
    const scope = new CaptureScope(workdir);
    const subst = (value: unknown): unknown =>
        workdir === undefined ? value : substituteWorkdirDeep(value, workdir);

    function merge(prev: unknown, act: unknown): unknown {
        // invariant: placeholders match the raw actual, so `{{workdir}}` sees the real cwd.
        if (typeof prev === 'string' && hasPlaceholders(prev)) {
            return placeholderStringMatches(prev, act, scope) ? prev : subst(act);
        }
        if (Array.isArray(prev) && Array.isArray(act)) {
            return act.map((item, i) => (i < prev.length ? merge(prev[i], item) : subst(item)));
        }
        if (isPlainObject(prev) && isPlainObject(act)) {
            return Object.fromEntries(
                Object.entries(act).map(([key, item]) => [
                    key,
                    key in prev ? merge(prev[key], item) : subst(item),
                ]),
            );
        }
        return subst(act);
    }

    return merge(previous, actual);
}

/** Paired by pattern, not line index: a mid-file insertion keeps the shifted token lines. Each previous line is used once. */
const ANY_LINE = /^\s*\{\{any\}\}\s*$/u;

type Anchor = { line: string; offset: number };

function anchorOf(lines: readonly string[], from: number, step: -1 | 1): Anchor | undefined {
    for (
        let index = from + step, offset = step;
        index >= 0 && index < lines.length;
        index += step, offset += step
    ) {
        const line = lines[index] ?? '';
        if (line.trim() !== '' && !hasPlaceholders(line)) {
            return { line, offset };
        }
    }

    return undefined;
}

const PREFIX = 20;

function indexOfAnchor(lines: readonly string[], anchor: string, from: number): number {
    const exact = lines.indexOf(anchor, from);
    if (exact !== -1 || anchor.length <= PREFIX) {
        return exact;
    }
    const prefix = anchor.slice(0, PREFIX);

    return lines.findIndex((line, index) => index >= from && line.startsWith(prefix));
}

function anyRuns(
    prevLines: readonly string[],
    actualLines: readonly string[],
): Map<number, { end: number; line: string }> {
    const runs = new Map<number, { end: number; line: string }>();
    let cursor = 0;
    for (const [index, line] of prevLines.entries()) {
        if (!ANY_LINE.test(line)) {
            continue;
        }
        const before = anchorOf(prevLines, index, -1);
        const after = anchorOf(prevLines, index, 1);
        const found = before === undefined ? -1 : indexOfAnchor(actualLines, before.line, cursor);
        const start = before === undefined ? 0 : found === -1 ? -1 : found - before.offset;
        const anchored =
            after === undefined
                ? actualLines.length
                : indexOfAnchor(actualLines, after.line, Math.max(start, 0));
        const end = after === undefined ? anchored : anchored - after.offset + 1;
        if (start >= 0 && anchored !== -1 && end >= start) {
            runs.set(start, { end, line });
            cursor = end;
        }
    }

    return runs;
}

function withAnyRuns(previous: string, actual: string, merged: string): string {
    const runs = anyRuns(previous.split('\n'), actual.split('\n'));
    if (runs.size === 0) {
        return merged;
    }
    const lines = merged.split('\n');
    const kept: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
        const run = runs.get(index);
        if (run === undefined) {
            kept.push(lines[index] ?? '');
            continue;
        }
        kept.push(run.line);
        index = run.end - 1;
    }

    return kept.join('\n');
}

export function mergeTextPreservingPlaceholders(
    previous: null | string,
    actual: string,
    scope: CaptureScope,
): string {
    const merged = mergedLines(previous, actual, scope);

    return previous === null ? merged : withAnyRuns(previous, actual, merged);
}

function mergedLines(previous: null | string, actual: string, scope: CaptureScope): string {
    const substituted =
        scope.workdir === undefined ? actual : actual.replaceAll(scope.workdir, '{{workdir}}');

    if (previous === null) {
        return substituted;
    }

    const prevLines = previous.split('\n');
    const actualLines = substituted.split('\n');
    const rawLines = actual.split('\n');
    const consumed = new Set<number>();

    const covers = (prevIndex: number, actualIndex: number): boolean => {
        const prev = prevLines[prevIndex];
        if (prev === undefined || !hasPlaceholders(prev)) {
            return false;
        }
        const line = actualLines[actualIndex];
        if (line === undefined) {
            return false;
        }
        return (
            textEquals(prev, line, new CaptureScope(scope.workdir)) ||
            textEquals(prev, rawLines[actualIndex] ?? line, new CaptureScope(scope.workdir))
        );
    };

    // oxlint-disable-next-line unicorn/no-useless-undefined -- the hole IS the value: dropping it makes the callback return void and the array `void[]`
    const merged: (string | undefined)[] = actualLines.map(() => undefined);
    for (const [index] of actualLines.entries()) {
        if (covers(index, index)) {
            merged[index] = prevLines[index];
            consumed.add(index);
        }
    }
    for (const [index, line] of actualLines.entries()) {
        if (merged[index] !== undefined) {
            continue;
        }
        for (const [prevIndex] of prevLines.entries()) {
            if (consumed.has(prevIndex) || !covers(prevIndex, index)) {
                continue;
            }
            merged[index] = prevLines[prevIndex];
            consumed.add(prevIndex);
            break;
        }
        merged[index] ??= line;
    }
    return merged.join('\n');
}
