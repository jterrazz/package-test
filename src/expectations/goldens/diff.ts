const GREEN = '\u001B[32m';
const RED = '\u001B[31m';
const DIM = '\u001B[2m';
const BOLD = '\u001B[1m';
const RESET = '\u001B[0m';

const SHOWN_LINES = 5;

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
    const lines: string[] = [
        `Table "${table}" mismatch`,
        `${DIM}  query: ${columns.join(', ')}${RESET}`,
        `${DIM}  expected: ${rowLabel(expectedCount)}${RESET}`,
        `${DIM}  received: ${rowLabel(actualCount)}${RESET}`,
        '',
        `${GREEN}- Expected${RESET}`,
        `${RED}+ Received${RESET}`,
        '',
    ];

    const header = columns.join('  |  ');
    lines.push(`${DIM}  ${header}${RESET}`);

    for (const { actual, expected, matched } of pairs) {
        // Stryker disable next-line ConditionalExpression: a matched pair always holds the row it matched
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

function bodyLines(expected: unknown, actual: unknown): [string[], string[]] {
    if (typeof expected === 'string' && typeof actual === 'string') {
        return [expected.split('\n'), actual.split('\n')];
    }
    return [
        JSON.stringify(expected, null, 2).split('\n'),
        JSON.stringify(actual, null, 2).split('\n'),
    ];
}

type LineEquals = (expected: string, actual: string) => boolean;

const strictEquals: LineEquals = (expected, actual) => expected === actual;

function renderLines(
    expectedLines: string[],
    actualLines: string[],
    equals: LineEquals,
): { marked: boolean; rendered: string[] } {
    const rendered: string[] = [];
    let marked = false;
    for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
        const exp = expectedLines[i];
        const act = actualLines[i];
        // Stryker disable next-line ConditionalExpression,LogicalOperator: the equalities callers pass, strict or token-aware, answer false for a line one side lacks; the guards keep them typed
        if (exp !== undefined && act !== undefined && equals(exp, act)) {
            // invariant: the line matched: render the expected form, the one carrying the token.
            rendered.push(`  ${exp}`);
            continue;
        }
        marked = true;
        rendered.push(
            ...(exp === undefined ? [] : [`${GREEN}- ${exp}${RESET}`]),
            ...(act === undefined ? [] : [`${RED}+ ${act}${RESET}`]),
        );
    }

    return { marked, rendered };
}

export function formatResponseDiff(file: string, expected: unknown, actual: unknown): string {
    const lines: string[] = [
        `Response mismatch (${file})`,
        '',
        `${GREEN}- Expected${RESET}`,
        `${RED}+ Received${RESET}`,
        '',
    ];

    const [expectedLines, actualLines] = bodyLines(expected, actual);
    return [...lines, ...renderLines(expectedLines, actualLines, strictEquals).rendered].join('\n');
}

/** `equals` is token-aware, so a matched `{{url}}` line shows as equal; if it marks nothing, the strict rendering is used. */
export function formatStdoutDiff(
    file: string,
    expected: string,
    actual: string,
    options?: { equals?: LineEquals },
): string {
    const lines: string[] = [
        `Output mismatch (${file})`,
        '',
        `${GREEN}- Expected${RESET}`,
        `${RED}+ Received${RESET}`,
        '',
    ];

    const expectedLines = expected.split('\n');
    const actualLines = actual.split('\n');
    const equals = options?.equals ?? strictEquals;

    const first = renderLines(expectedLines, actualLines, equals);
    const rendered = first.marked
        ? first.rendered
        : renderLines(expectedLines, actualLines, strictEquals).rendered;

    return [...lines, ...rendered].join('\n');
}

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
        const differing = Array.from(
            { length: Math.max(expectedLines.length, actualLines.length) },
            (_, index) => index,
        ).filter((index) => expectedLines[index] !== actualLines[index]);
        lines.push(
            `${BOLD}~ changed  ${path}${RESET}  ${DIM}(${differing.length} line${differing.length === 1 ? '' : 's'} differ)${RESET}`,
        );
        for (const index of differing.slice(0, SHOWN_LINES)) {
            const exp = expectedLines[index];
            const act = actualLines[index];
            lines.push(
                `${DIM}    line ${index + 1}:${RESET}`,
                ...(exp === undefined ? [] : [`    ${GREEN}- ${exp}${RESET}`]),
                ...(act === undefined ? [] : [`    ${RED}+ ${act}${RESET}`]),
            );
        }
        if (differing.length > SHOWN_LINES) {
            lines.push(`    ${DIM}... ${differing.length - SHOWN_LINES} more line(s)${RESET}`);
        }
    }

    lines.push('', `${DIM}${hint}${RESET}`);

    return lines.join('\n');
}

function rowLabel(n: number): string {
    return n === 1 ? '1 row' : `${n} rows`;
}

// invariant: a cell as a reader reads it: text and big numbers bare, a date in ISO, anything else as JSON, and a cell with no JSON as null.
function cellText(value: unknown): string {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'string' || typeof value === 'bigint') {
        return String(value);
    }
    return JSON.stringify(value) ?? 'null';
}

function formatRow(row: readonly unknown[]): string {
    return row.map((value) => cellText(value)).join('  |  ');
}
