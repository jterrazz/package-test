/**
 * What a linter's report proves, normalised for a golden: one line per
 * diagnostic, `<file>:<line>:<column>  <plugin>(<rule>)` — where the rule fired
 * and which rule it was, never its wording.
 *
 * It reads the two lines the family's linters print. oxlint's `unix` rendering,
 * `<file>:<line>:<column>: <message> [<Severity>/<plugin>(<rule>)]`, and the
 * conventions checker's report line, the compiler convention every editor's
 * problem matcher parses: `<file>:<line>:<column>: <severity>
 * <plugin>(<rule>): <message>`. Every other line — a tally, a summary, a blank
 * line, a notice — is dropped, so a reworded message or summary moves no
 * golden, and a run with no diagnostic normalises to the empty text.
 *
 * It is a `transform`: `specification.cli(bin, { transform: lintReport })`
 * applies it to both streams before every comparison.
 */

/** oxlint's `unix` line. */
const OXLINT_LINE = /^(?<at>\S+?:\d+:\d+): .* \[(?:Error|Warning)\/(?<rule>[\w-]+\([^)\]]+\))\]$/u;

/** The checker's line — and any linter printing the same convention. */
const REPORT_LINE = /^(?<at>\S+?:\d+:\d+): (?:error|warning) (?<rule>[\w-]+\([^)]+\)): /u;

/** One diagnostic, normalised — or `undefined` for a line that is not one. */
function diagnosticOf(line: string): string | undefined {
    const found = (OXLINT_LINE.exec(line) ?? REPORT_LINE.exec(line))?.groups;
    return found === undefined ? undefined : `${found.at}  ${found.rule}`;
}

/** Normalise a linter's report to the lines a golden keeps. */
export function lintReport(text: string): string {
    const lines = text
        .split('\n')
        .map(diagnosticOf)
        .filter((line) => line !== undefined);
    return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}
