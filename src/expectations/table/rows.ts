import type { CaptureScope } from '../tokens/match.js';
import { structuralEquals } from '../tokens/structural.js';

/**
 * A table's rows against the rows a test states.
 *
 * A table has no order of its own: the rows a query returns come back in
 * whatever order the database keeps them, and a first column of random ids
 * orders them differently run to run. So rows compare as a multiset by
 * default — each stated row paired with a row of the table it matches, cell
 * by cell through the token grammar — and in order only when order is the
 * claim, `{ ordered: true }`, the order of the table's first column.
 *
 * A token that captures (`{{uuid#event}}`) binds on the pairing that holds:
 * candidate pairs are tried on a fork of the scope, and only the pairing the
 * comparison settles on writes its captures back.
 */

/** Rows as a value written in place states them: one array of cells per row. */
export type Rows = readonly (readonly unknown[])[];

/** One line of a table comparison: a stated row, a row of the table, or both — and whether they match. */
export type RowPair = {
    actual?: undefined | unknown[];
    expected?: readonly unknown[] | undefined;
    matched: boolean;
};

/** A table comparison: whether it passes, and the rows paired for its diff and its rewrite. */
export type RowPairing = { pairs: RowPair[]; pass: boolean };

/** Does a stated row match a row of the table, captures recorded in `scope`? */
function rowFits(expected: readonly unknown[], actual: unknown[], scope: CaptureScope): boolean {
    return (
        expected.length === actual.length &&
        expected.every((cell, index) => structuralEquals(cell, actual[index], scope))
    );
}

/** How many cells of a stated row match a row of the table — what pairs two rows that differ. */
function fittingCells(
    expected: readonly unknown[],
    actual: unknown[],
    scope: CaptureScope,
): number {
    return expected.filter((cell, index) => structuralEquals(cell, actual[index], scope.fork()))
        .length;
}

/** Row by row, in the table's order. */
function pairInOrder(expected: Rows, actual: unknown[][], scope: CaptureScope): RowPairing {
    const count = Math.max(expected.length, actual.length);
    const pairs: RowPair[] = [];
    for (let index = 0; index < count; index += 1) {
        const stated = expected[index];
        const row = actual[index];
        const matched = stated !== undefined && row !== undefined && rowFits(stated, row, scope);
        pairs.push({ actual: row, expected: stated, matched });
    }
    return { pairs, pass: pairs.every((pair) => pair.matched) };
}

/**
 * The most stated rows that can each take a row of their own, by augmenting
 * paths over what each could match alone: row of the table → the stated row
 * that holds it.
 */
function maximumMatching(
    fits: readonly (readonly boolean[])[],
    width: number,
): Map<number, number> {
    const taken = new Map<number, number>();
    const augment = (row: number, seen: Set<number>): boolean => {
        for (let column = 0; column < width; column += 1) {
            if (fits[row]?.[column] !== true || seen.has(column)) {
                continue;
            }
            seen.add(column);
            const holder = taken.get(column);
            if (holder === undefined || augment(holder, seen)) {
                taken.set(column, row);
                return true;
            }
        }
        return false;
    };
    for (let row = 0; row < fits.length; row += 1) {
        augment(row, new Set());
    }
    return taken;
}

/**
 * A pairing of every stated row with a row of its own that holds with the
 * captures shared across rows — searched in the stated order, each candidate
 * tried on a fork — or `undefined` when none does.
 */
function consistentPairing(
    expected: Rows,
    actual: unknown[][],
    fits: readonly (readonly boolean[])[],
    scope: CaptureScope,
): number[] | undefined {
    const chosen: number[] = [];
    const used = new Set<number>();
    const search = (row: number, current: CaptureScope): CaptureScope | undefined => {
        const stated = expected[row];
        if (stated === undefined) {
            return current;
        }
        for (let column = 0; column < actual.length; column += 1) {
            const candidate = actual[column];
            if (used.has(column) || fits[row]?.[column] !== true || candidate === undefined) {
                continue;
            }
            const fork = current.fork();
            if (!rowFits(stated, candidate, fork)) {
                continue;
            }
            used.add(column);
            chosen[row] = column;
            const settled = search(row + 1, fork);
            if (settled !== undefined) {
                return settled;
            }
            used.delete(column);
        }
        return undefined;
    };
    const settled = search(0, scope);
    if (settled === undefined) {
        return undefined;
    }
    scope.adopt(settled);
    return chosen;
}

/** What no match paired: the stated rows, and the rows of the table, by index. */
type Leftovers = { rows: number[]; stated: number[] };

/** The rows no match paired, each stated row with the unpaired row of the table it resembles most. */
function pairLeftovers(
    expected: Rows,
    actual: unknown[][],
    { rows, stated }: Leftovers,
    scope: CaptureScope,
): Map<number, number> {
    const paired = new Map<number, number>();
    const free = new Set(rows);
    for (const index of stated) {
        const row = expected[index] ?? [];
        let best: number | undefined;
        let bestScore = 0;
        for (const column of free) {
            const score = fittingCells(row, actual[column] ?? [], scope);
            if (score > bestScore) {
                best = column;
                bestScore = score;
            }
        }
        if (best !== undefined) {
            paired.set(index, best);
            free.delete(best);
        }
    }
    return paired;
}

/** As a multiset: every stated row paired with a row of the table it matches, whatever their order. */
function pairAsMultiset(expected: Rows, actual: unknown[][], scope: CaptureScope): RowPairing {
    const fits = expected.map((row) =>
        actual.map((candidate) => rowFits(row, candidate, scope.fork())),
    );
    const taken = maximumMatching(fits, actual.length);
    const holds = new Map([...taken].map(([column, row]) => [row, column]));
    const complete = holds.size === expected.length && expected.length === actual.length;
    const consistent = complete ? consistentPairing(expected, actual, fits, scope) : undefined;
    if (consistent !== undefined) {
        return {
            pairs: expected.map((row, index) => ({
                actual: actual[consistent[index] ?? -1],
                expected: row,
                matched: true,
            })),
            pass: true,
        };
    }
    const unstated = expected.flatMap((_, index) => (holds.has(index) ? [] : [index]));
    const unheld = actual.flatMap((_, column) => (taken.has(column) ? [] : [column]));
    const leftovers = pairLeftovers(expected, actual, { rows: unheld, stated: unstated }, scope);
    const shown = new Set([...holds.values(), ...leftovers.values()]);
    const pairs: RowPair[] = expected.map((row, index) => {
        const column = holds.get(index) ?? leftovers.get(index);
        return {
            actual: column === undefined ? undefined : actual[column],
            expected: row,
            // A pairing each row holds alone but not with the captures shared across rows matches none.
            matched: holds.has(index) && !complete,
        };
    });
    for (const [column, row] of actual.entries()) {
        if (!shown.has(column)) {
            pairs.push({ actual: row, matched: false });
        }
    }
    return { pairs, pass: false };
}

/**
 * Pair the rows a test states with the rows a table holds — as a multiset,
 * or in the table's order when `ordered` — for the verdict, the diff, and the
 * rows update mode writes.
 */
export function pairRows(
    expected: Rows,
    actual: unknown[][],
    scope: CaptureScope,
    ordered: boolean,
): RowPairing {
    return ordered ? pairInOrder(expected, actual, scope) : pairAsMultiset(expected, actual, scope);
}
