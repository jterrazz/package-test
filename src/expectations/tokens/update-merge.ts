import { CaptureScope } from './capture-scope.js';
import { hasPlaceholders, placeholderStringMatches } from './placeholders.js';
import { isPlainObject, textEquals } from './structural.js';

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
            // invariant: an item past the previous list merges against undefined, which is substitution alone.
            return act.map((item, i) => merge(prev[i], item));
        }
        if (isPlainObject(prev) && isPlainObject(act)) {
            return Object.fromEntries(
                Object.entries(act).map(([key, item]) => [key, merge(prev[key], item)]),
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
    const side = step === 1 ? lines.slice(from + 1) : lines.slice(0, from).toReversed();
    const at = side.findIndex((line) => line.trim() !== '' && !hasPlaceholders(line));
    return at === -1 ? undefined : { line: String(side[at]), offset: step * (at + 1) };
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
        let start = 0;
        if (before !== undefined) {
            const found = indexOfAnchor(actualLines, before.line, cursor);
            if (found === -1) {
                continue;
            }
            start = found - before.offset;
        }
        let end = actualLines.length;
        if (after !== undefined) {
            // invariant: an after anchor never found reads as -1, which ends the block before it starts.
            end = indexOfAnchor(actualLines, after.line, start) - after.offset + 1;
        }
        // invariant: a block covers one line at least: one that covered none would hold no line to stand for, and the walk over it would never move.
        if (end > start) {
            runs.set(start, { end, line });
            cursor = end;
        }
    }

    return runs;
}

function withAnyRuns(previous: string, actual: string, merged: string): string {
    const runs = anyRuns(previous.split('\n'), actual.split('\n'));
    const lines = merged.split('\n');
    const kept: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
        const run = runs.get(index);
        if (run === undefined) {
            kept.push(String(lines[index]));
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

    /** A previous token line covers an actual line it matches, read with the workdir as the token or as the path. */
    const covers = (prevIndex: number, actualIndex: number): boolean => {
        const prev = String(prevLines[prevIndex]);
        return (
            hasPlaceholders(prev) &&
            (textEquals(prev, String(actualLines[actualIndex]), new CaptureScope(scope.workdir)) ||
                textEquals(prev, String(rawLines[actualIndex]), new CaptureScope(scope.workdir)))
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
