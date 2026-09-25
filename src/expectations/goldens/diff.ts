/**
 * How a mismatch reads: every diff a failed expectation prints — a table's
 * rows, a response, a stream, an exit code, a directory tree, a file — and the
 * normalisers a test compares printed output through.
 */

// ── Colors ──

const GREEN = '\u001B[32m';
const RED = '\u001B[31m';
const DIM = '\u001B[2m';
const BOLD = '\u001B[1m';
const RESET = '\u001B[0m';

// ── Table diff ──

/** One line of a table diff: a stated row, a row of the table, or both — and whether they match. */
export type TableDiffPair = {
    actual?: undefined | unknown[];
    expected?: readonly unknown[] | undefined;
    matched: boolean;
};

export function formatTableDiff(
    table: string,
    columns: string[],
    pairs: readonly TableDiffPair[],
): string {
    const expectedCount = pairs.filter((pair) => pair.expected !== undefined).length;
    const actualCount = pairs.filter((pair) => pair.actual !== undefined).length;
    const lines: string[] = [];

    lines.push(
        `Table "${table}" mismatch`,
        `${DIM}  query: ${columns.join(', ')}${RESET}`,
        `${DIM}  expected: ${rowLabel(expectedCount)}${RESET}`,
        `${DIM}  received: ${rowLabel(actualCount)}${RESET}`,
        '',
        `${GREEN}- Expected${RESET}`,
        `${RED}+ Received${RESET}`,
        '',
    );

    const header = columns.join('  |  ');
    lines.push(`${DIM}  ${header}${RESET}`);

    for (const { actual, expected, matched } of pairs) {
        if (matched && actual !== undefined) {
            lines.push(`  ${formatRow(actual)}`);
            continue;
        }
        if (expected !== undefined) {
            lines.push(`${GREEN}- ${formatRow(expected)}${RESET}`);
        }
        if (actual !== undefined) {
            lines.push(`${RED}+ ${formatRow(actual)}${RESET}`);
        }
    }

    if (pairs.length === 0) {
        lines.push(`  (empty)`);
    }

    return lines.join('\n');
}

// ── Response diff ──

/** A body's lines as the diff shows them: a text pair as its own lines, anything else as JSON. */
function bodyLines(expected: unknown, actual: unknown): [string[], string[]] {
    if (typeof expected === 'string' && typeof actual === 'string') {
        return [expected.split('\n'), actual.split('\n')];
    }
    return [
        JSON.stringify(expected, null, 2).split('\n'),
        JSON.stringify(actual, null, 2).split('\n'),
    ];
}

export function formatResponseDiff(file: string, expected: unknown, actual: unknown): string {
    const lines: string[] = [];

    lines.push(
        `Response mismatch (${file})`,
        '',
        `${GREEN}- Expected${RESET}`,
        `${RED}+ Received${RESET}`,
        '',
    );

    const [expectedLines, actualLines] = bodyLines(expected, actual);
    const maxLines = Math.max(expectedLines.length, actualLines.length);

    for (let i = 0; i < maxLines; i++) {
        const exp = expectedLines[i];
        const act = actualLines[i];

        if (exp === act) {
            lines.push(`  ${exp}`);
        } else {
            if (exp !== undefined) {
                lines.push(`${GREEN}- ${exp}${RESET}`);
            }
            if (act !== undefined) {
                lines.push(`${RED}+ ${act}${RESET}`);
            }
        }
    }

    return lines.join('\n');
}

// ── Stdout/stderr diff ──

/** Line-level equality for the diff. Defaults to strict string equality. */
type LineEquals = (expected: string, actual: string) => boolean;

const strictEquals: LineEquals = (expected, actual) => expected === actual;

function renderLines(
    expectedLines: string[],
    actualLines: string[],
    equals: LineEquals,
): { marked: number; rendered: string[] } {
    const rendered: string[] = [];
    let marked = 0;
    const maxLines = Math.max(expectedLines.length, actualLines.length);

    for (let i = 0; i < maxLines; i++) {
        const exp = expectedLines[i];
        const act = actualLines[i];

        if (exp !== undefined && act !== undefined && equals(exp, act)) {
            // The line MATCHED — render the expected form, which is the one
            // carrying the token, and mark nothing.
            rendered.push(`  ${exp}`);
            continue;
        }
        marked++;
        if (exp !== undefined) {
            rendered.push(`${GREEN}- ${exp}${RESET}`);
        }
        if (act !== undefined) {
            rendered.push(`${RED}+ ${act}${RESET}`);
        }
    }

    return { marked, rendered };
}

/**
 * Render an expected/received diff over two texts.
 *
 * `equals` is how a line is judged EQUAL. Callers that compare through the
 * `{{token}}` grammar pass a token-aware predicate, so a `{{url}}` line that
 * matched is shown as equal — with its token, not as a `-`/`+` pair against
 * the concrete URL. Marking a line the comparison ACCEPTED buries the one it
 * rejected: the reader then has to work out which of the differences is the
 * actual cause.
 *
 * Safety net: if the token-aware pass marks nothing at all, the whole diff
 * would render as a clean block against a failure that really happened (a
 * `#ref` captured inconsistently across lines, say). The strict rendering is
 * used instead, so a diff always shows the reader something.
 */
export function formatStdoutDiff(
    file: string,
    expected: string,
    actual: string,
    options?: { equals?: LineEquals },
): string {
    const lines: string[] = [];

    lines.push(
        `Output mismatch (${file})`,
        '',
        `${GREEN}- Expected${RESET}`,
        `${RED}+ Received${RESET}`,
        '',
    );

    const expectedLines = expected.split('\n');
    const actualLines = actual.split('\n');
    const equals = options?.equals ?? strictEquals;

    const first = renderLines(expectedLines, actualLines, equals);
    const rendered =
        first.marked === 0 && equals !== strictEquals
            ? renderLines(expectedLines, actualLines, strictEquals).rendered
            : first.rendered;

    return [...lines, ...rendered].join('\n');
}

// ── Directory diff ──

type DirectoryDiffData = {
    added: string[];
    changed: { path: string; expected: string; actual: string }[];
    removed: string[];
};

export function formatDirectoryDiff(
    fixtureName: string,
    diff: DirectoryDiffData,
    hint: string,
): string {
    const lines: string[] = [];

    const total = diff.added.length + diff.removed.length + diff.changed.length;
    lines.push(
        `Directory mismatch: ${BOLD}${fixtureName}${RESET}`,
        `${DIM}  ${total} difference${total === 1 ? '' : 's'}: ${diff.added.length} added, ${diff.removed.length} removed, ${diff.changed.length} changed${RESET}`,
        '',
        `${GREEN}- Expected (fixture)${RESET}`,
        `${RED}+ Received (generated)${RESET}`,
        '',
    );

    for (const path of diff.added) {
        lines.push(`${RED}+ added    ${path}${RESET}  ${DIM}(not in fixture)${RESET}`);
    }
    for (const path of diff.removed) {
        lines.push(`${GREEN}- removed  ${path}${RESET}  ${DIM}(in fixture, not generated)${RESET}`);
    }
    for (const { path, expected, actual } of diff.changed) {
        const expectedLines = expected.split('\n');
        const actualLines = actual.split('\n');
        const changedCount = countLineDifferences(expectedLines, actualLines);
        lines.push(
            `${BOLD}~ changed  ${path}${RESET}  ${DIM}(${changedCount} line${changedCount === 1 ? '' : 's'} differ)${RESET}`,
        );

        let shown = 0;
        const maxShown = 5;
        const maxLines = Math.max(expectedLines.length, actualLines.length);
        for (let i = 0; i < maxLines && shown < maxShown; i++) {
            const exp = expectedLines[i];
            const act = actualLines[i];
            if (exp !== act) {
                lines.push(`${DIM}    line ${i + 1}:${RESET}`);
                if (exp !== undefined) {
                    lines.push(`    ${GREEN}- ${exp}${RESET}`);
                }
                if (act !== undefined) {
                    lines.push(`    ${RED}+ ${act}${RESET}`);
                }
                shown++;
            }
        }
        if (changedCount > maxShown) {
            lines.push(`    ${DIM}... ${changedCount - maxShown} more line(s)${RESET}`);
        }
    }

    lines.push('', `${DIM}${hint}${RESET}`);

    return lines.join('\n');
}

function countLineDifferences(expected: string[], actual: string[]): number {
    let count = 0;
    const max = Math.max(expected.length, actual.length);
    for (let i = 0; i < max; i++) {
        if (expected[i] !== actual[i]) {
            count++;
        }
    }
    return count;
}

// ── Helpers ──

function rowLabel(n: number): string {
    return n === 1 ? '1 row' : `${n} rows`;
}

function formatRow(row: readonly unknown[]): string {
    return row.map((v) => String(v ?? 'null')).join('  |  ');
}
