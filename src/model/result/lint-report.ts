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
 *
 * The runner states oxlint's format — `--format=unix`, or `agent`, whose line
 * is the checker's. Without it oxlint picks its renderer off the environment:
 * one line per diagnostic in a shell that advertises an AI agent, graphical
 * frames everywhere else, CI included. A frame is refused rather than dropped,
 * because dropping it would read as a clean run.
 */

/** oxlint's `unix` line. */
const OXLINT_LINE = /^(?<at>\S+?:\d+:\d+): .* \[(?:Error|Warning)\/(?<rule>[\w-]+\([^)\]]+\))\]$/u;

/** The checker's line — and any linter printing the same convention. */
const REPORT_LINE = /^(?<at>\S+?:\d+:\d+): (?:error|warning) (?<rule>[\w-]+\([^)]+\)): /u;

/** The head of a diagnostic in oxlint's graphical rendering: `  x <plugin>(<rule>): …`, `!` for a warning. */
const GRAPHICAL_LINE = /^\s+[!x] [\w-]+\([^)]+\): /u;

/** One diagnostic, normalised — or `undefined` for a line that is not one. */
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
        .filter((line) => line !== undefined);
    return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}
