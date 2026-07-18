/**
 * Extract text blocks from output that contain a pattern.
 * Splits by blank lines (how linter/compiler output is structured),
 * returns only blocks matching the pattern.
 *
 * @example
 * expect(grep(result.stdout, "unused-var.ts")).toContain("no-unused-vars")
 * expect(grep(result.stdout, "valid/sorted.ts")).not.toContain("sort-imports")
 */
export function grep(output: string, pattern: string): string {
    // eslint-disable-next-line no-control-regex
    const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
    const blocks = clean.split(/\n\s*\n/);
    return blocks.filter((block) => block.includes(pattern)).join('\n\n');
}
