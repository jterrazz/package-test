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
    // oxlint-disable-next-line no-control-regex -- the ANSI escape IS the control character: stripping it is the point
    const clean = output.replaceAll(/\u001B\[[0-9;]*m/gu, '');
    const blocks = clean.split(/\n\s*\n/u);
    return blocks.filter((block) => block.includes(pattern)).join('\n\n');
}
