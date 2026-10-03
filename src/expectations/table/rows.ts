import type { CaptureScope } from '../tokens/capture-scope.js';
import { structuralEquals } from '../tokens/structural.js';

/** A table has no order: rows compare as a multiset unless `{ ordered: true }`. Captures bind only on the pairing the comparison settles on. */

export type Rows = readonly (readonly unknown[])[];

export type RowPair = {
    actual?: undefined | unknown[];
    expected?: readonly unknown[] | undefined;
    matched: boolean;
};

export type RowPairing = { pairs: RowPair[]; pass: boolean };

function rowFits(expected: readonly unknown[], actual: unknown[], scope: CaptureScope): boolean {
    return (
        expected.length === actual.length &&
        expected.every((cell, index) => structuralEquals(cell, actual[index], scope))
    );
}

function fittingCells(
    expected: readonly unknown[],
    actual: unknown[],
    scope: CaptureScope,
): number {
    return expected.filter((cell, index) => structuralEquals(cell, actual[index], scope.fork()))
        .length;
}

function pairInOrder(expected: Rows, actual: unknown[][], scope: CaptureScope): RowPairing {
    const pairs = Array.from(
        { length: Math.max(expected.length, actual.length) },
        (_, index): RowPair => {
            const stated = expected[index];
            const row = actual[index];
            const matched =
                stated !== undefined && row !== undefined && rowFits(stated, row, scope);
            return { actual: row, expected: stated, matched };
        },
    );
    return { pairs, pass: pairs.every((pair) => pair.matched) };
}

/** Kuhn's augmenting paths: each stated row holds an actual row it fits, as many as can at once. */
function maximumMatching(fits: readonly (readonly boolean[])[]): Map<number, number> {
    const taken = new Map<number, number>();
    const augment = (row: number, seen: Set<number>): boolean => {
        // Stryker disable next-line ArrayDeclaration: a row index read from the fits themselves always has its row
        for (const [column, fit] of (fits[row] ?? []).entries()) {
            if (!fit || seen.has(column)) {
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
    for (const row of fits.keys()) {
        augment(row, new Set());
    }
    return taken;
}

/** The pairing that holds with the captures shared across rows, searched in stated order; the fits each row holds alone bound nothing a shared capture can widen. */
function consistentPairing(
    expected: Rows,
    actual: unknown[][],
    scope: CaptureScope,
): Map<number, number> | undefined {
    const chosen = new Map<number, number>();
    const used = new Set<number>();
    const search = (row: number, current: CaptureScope): CaptureScope | undefined => {
        const stated = expected[row];
        if (stated === undefined) {
            return current;
        }
        for (const [column, candidate] of actual.entries()) {
            const fork = current.fork();
            if (used.has(column) || !rowFits(stated, candidate, fork)) {
                continue;
            }
            used.add(column);
            chosen.set(row, column);
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

type Leftovers = { rows: number[]; stated: number[] };

/** Each stated row no actual row fits is shown against the free row it resembles most, the first on a tie; one resembling none stands alone. */
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
        const [best] = [...free]
            .map((column) => ({ column, score: fittingCells(row, actual[column] ?? [], scope) }))
            .filter(({ score }) => score > 0)
            .toSorted((one, other) => other.score - one.score);
        if (best !== undefined) {
            paired.set(index, best.column);
            free.delete(best.column);
        }
    }
    return paired;
}

function pairAsMultiset(expected: Rows, actual: unknown[][], scope: CaptureScope): RowPairing {
    const fits = expected.map((row) =>
        actual.map((candidate) => rowFits(row, candidate, scope.fork())),
    );
    const taken = maximumMatching(fits);
    const holds = new Map([...taken].map(([column, row]) => [row, column]));
    const complete = holds.size === expected.length && expected.length === actual.length;
    const consistent = complete ? consistentPairing(expected, actual, scope) : undefined;
    if (consistent !== undefined) {
        return {
            pairs: expected.map((row, index) => ({
                actual: actual[consistent.get(index) ?? actual.length],
                expected: row,
                matched: true,
            })),
            pass: true,
        };
    }
    const unstated = [...expected.keys()].filter((index) => !holds.has(index));
    const unheld = [...actual.keys()].filter((column) => !taken.has(column));
    const leftovers = pairLeftovers(expected, actual, { rows: unheld, stated: unstated }, scope);
    const shown = new Set([...holds.values(), ...leftovers.values()]);
    const pairs: RowPair[] = expected.map((row, index) => ({
        actual: actual[holds.get(index) ?? leftovers.get(index) ?? actual.length],
        expected: row,
        // invariant: a pairing each row holds alone but not with the captures shared across rows matches none.
        matched: holds.has(index) && !complete,
    }));
    for (const [column, row] of actual.entries()) {
        if (!shown.has(column)) {
            pairs.push({ actual: row, matched: false });
        }
    }
    return { pairs, pass: false };
}

export function pairRows(
    expected: Rows,
    actual: unknown[][],
    scope: CaptureScope,
    ordered: boolean,
): RowPairing {
    return ordered ? pairInOrder(expected, actual, scope) : pairAsMultiset(expected, actual, scope);
}
