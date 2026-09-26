import type { TokenViolation } from './checker.js';
import { decodeText } from './tree.js';

/** Only spellings decidable on sight: the bare word `now` is a column name as often as a clock read. */
const CLOCK_READ = /'now'|\bCURRENT_(?:TIMESTAMP|DATE|TIME)\b|\bNOW\s*\(\s*\)/iu;

const SQL_LINE_COMMENT = /--[^\n]*/gu;
const SQL_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//gu;

/** Line for line, so a finding still points. */
function withoutComments(text: string): string {
    return text
        .replaceAll(SQL_BLOCK_COMMENT, (block) => block.replaceAll(/[^\n]/gu, ' '))
        .replaceAll(SQL_LINE_COMMENT, '');
}

/** The chain's `.clock()` pins what the code reads, so a seed never asks the machine; under SQLite `datetime('now')` also writes a space where an ORM writes `T`, and the two mis-sort. */
export function checkSeedClockReads(path: string, rel: string, name: string): TokenViolation[] {
    // `seeds-are-sql` (oxlint) owns the extension rule; this pass reads the SQL alone.
    if (!name.endsWith('.sql')) {
        return [];
    }
    const text = decodeText(path);
    if (text === null) {
        return [];
    }
    const violations: TokenViolation[] = [];
    for (const [index, line] of withoutComments(text).split('\n').entries()) {
        const found = CLOCK_READ.exec(line);
        if (found === null) {
            continue;
        }
        violations.push({
            file: rel,
            line: index + 1,
            fix: `replace \`${found[0]}\` with the instant the case is about (\`'2026-01-01T00:00:00Z'\`), and pin the run's clock on the chain with \`.clock()\``,
            found: `\`${found[0]}\` reads the clock in a seed`,
            rule: 'seeds-state-absolute-time',
            severity: 'error',
        });
    }
    return violations;
}
