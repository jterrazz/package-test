import { resolve } from 'node:path';
import { afterAll } from 'vitest';

import { specification } from '../../src/index.js';

/**
 * The runner every lint rule's `<case>.spec.yaml` is bound to (the `literate()`
 * plugin of the `unit` project names it): a tree in, the command, the
 * NORMALISED report out.
 *
 * The normalisation is the runner's `transform`, applied to both streams before
 * every comparison:
 *
 * - an oxlint diagnostic in the `unix` rendering the wrapper pins
 *   (`<file>:<line>:<column>: <message> [<Severity>/<plugin>(<rule>)]`) reads
 *   `<file>:<line>:<column>  <plugin>(<rule>)` — the POSITION and the rule, so a
 *   golden proves where a rule fired and not only that it did, and a reworded
 *   message moves no golden;
 * - the `N problem(s)` tally and blank lines are dropped: one line per
 *   diagnostic, nothing else;
 * - every other line — the checker's, whose wording is this package's product
 *   and asserted as written — passes through.
 *
 * Requires `npm run build` first: the wrapper runs `dist/oxlint.js` and
 * `dist/checker.js`.
 */
const REPORT_BIN = resolve(import.meta.dirname, '../fixtures/lint-cli/report.sh');

const DIAGNOSTIC = /^(?<at>\S+?:\d+:\d+): .* \[(?:Error|Warning)\/(?<rule>[^\]]+)\]$/u;
const TALLY = /^\d+ problems?$/u;

function normalisedReport(text: string): string {
    const lines = text
        .split('\n')
        .filter((line) => line.trim() !== '' && !TALLY.test(line))
        .map((line) => {
            const found = DIAGNOSTIC.exec(line)?.groups;
            return found === undefined ? line : `${found.at}  ${found.rule}`;
        });
    return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}

export const { cleanup, cli } = await specification.cli(REPORT_BIN, {
    transform: normalisedReport,
});

afterAll(cleanup);
