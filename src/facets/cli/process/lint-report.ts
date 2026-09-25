/** Keeps `<file>:<line>:<column>  <plugin>(<rule>)` per diagnostic, sorted: oxlint prints files as its threads finish. A graphical frame is refused, since dropping it would read as a clean run. */

/** oxlint's `unix` line. */
const OXLINT_LINE = /^(?<at>\S+?:\d+:\d+): .* \[(?:Error|Warning)\/(?<rule>[\w-]+\([^)\]]+\))\]$/u;

/** The checker's line — and any linter printing the same convention. */
const REPORT_LINE = /^(?<at>\S+?:\d+:\d+): (?:error|warning) (?<rule>[\w-]+\([^)]+\)): /u;

/** The head of a diagnostic in oxlint's graphical rendering: `  x <plugin>(<rule>): …`, `!` for a warning. */
const GRAPHICAL_LINE = /^\s+[!x] [\w-]+\([^)]+\): /u;

function diagnosticOf(line: string): string | undefined {
    const found = (OXLINT_LINE.exec(line) ?? REPORT_LINE.exec(line))?.groups;
    return found === undefined ? undefined : `${found.at}  ${found.rule}`;
}

/** Normalise a linter's report to the lines a golden keeps. */
export function lintReport(text: string): string {
    const graphical = text.split('\n').find((line) => GRAPHICAL_LINE.test(line));
    if (graphical !== undefined) {
        throw new Error(
            `lintReport reads one line per diagnostic, and this report is oxlint's graphical rendering (${graphical.trim()}) — run oxlint with --format=unix or --format=agent: without it, oxlint picks its renderer off the environment.`,
        );
    }
    const lines = text
        .split('\n')
        .map(diagnosticOf)
        .filter((line) => line !== undefined)
        .toSorted(byPosition);
    return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

function positionOf(line: string): [string, number, number] {
    const [at = ''] = line.split('  ');
    const [column = '0', row = '0', ...file] = at.split(':').toReversed();
    return [file.toReversed().join(':'), Number(row), Number(column)];
}

function byPosition(a: string, b: string): number {
    const [fileA, rowA, columnA] = positionOf(a);
    const [fileB, rowB, columnB] = positionOf(b);
    if (fileA !== fileB) {
        return fileA < fileB ? -1 : 1;
    }
    if (rowA !== rowB || columnA !== columnB) {
        return rowA === rowB ? columnA - columnB : rowA - rowB;
    }
    return a < b ? -1 : Number(a > b);
}
