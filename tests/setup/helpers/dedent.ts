/**
 * Strip common leading whitespace from a template literal.
 * Also removes the first and last empty lines.
 */
export function dedent(strings: TemplateStringsArray, ...values: unknown[]): string {
  const result = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");

  // Remove first/last empty lines
  const lines = result.split("\n");
  if (lines[0].trim() === "") {
    lines.shift();
  }
  if (lines.at(-1)?.trim() === "") {
    lines.pop();
  }

  // Find minimum indentation
  const minIndent = lines
    .filter((l) => l.trim().length > 0)
    .reduce((min, line) => {
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      return Math.min(min, indent);
    }, Infinity);

  // Strip it
  return lines.map((line) => line.slice(minIndent)).join("\n");
}
