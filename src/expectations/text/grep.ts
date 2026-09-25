import { stripAnsiCodes } from './ansi.js';

/**
 * The blocks of an output that contain a pattern: split by blank lines (how
 * linter and compiler output is structured), ANSI stripped, only the blocks
 * holding the pattern kept. Reached as `TextAccessor.grep`.
 *
 * @example
 *   expect(result.stdout.grep('unused-var.ts').text).toContain('no-unused-vars');
 */
export function grep(output: string, pattern: string): string {
    const clean = stripAnsiCodes(output);
    const blocks = clean.split(/\n\s*\n/u);
    return blocks.filter((block) => block.includes(pattern)).join('\n\n');
}
