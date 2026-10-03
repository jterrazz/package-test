import { renderRows } from '../in-place/in-place.js';
import { pairRows } from '../table/rows.js';
import type { Rows } from '../table/rows.js';
import type { TableAccessor } from '../table/table.js';
import { CaptureScope } from '../tokens/capture-scope.js';
import { renderExpected, structuralEquals } from '../tokens/structural.js';
import { formatTableDiff } from './diff.js';
import { failed, passed } from './file-goldens.js';
import type { MatcherResult } from './file-goldens.js';
import { IN_PLACE } from './text-assertions.js';
import { recordsInPlace, UNRECORDED, unrecorded, writeAt } from './value-goldens.js';
import type { InPlace } from './value-goldens.js';

export function isRows(expected: unknown): expected is Rows {
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
                      return structuralEquals(before, cell, new CaptureScope()) ? before : cell;
                  }),
              ],
    );
}

export async function matchTableValue(
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

export function tableExpectation(expected: unknown): '' | Rows | undefined {
    if (isRows(expected)) {
        return expected;
    }
    return unrecorded(expected) ? '' : undefined;
}
