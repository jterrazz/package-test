import { stripAnsiCodes } from './ansi.js';

export function grep(output: string, pattern: string): string {
    const clean = stripAnsiCodes(output);
    const blocks = clean.split(/\n\s*\n/u);
    return blocks.filter((block) => block.includes(pattern)).join('\n\n');
}
