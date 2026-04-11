# Function: grep()

```ts
function grep(output, pattern): string;
```

Defined in: [specification/grep.ts:10](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/grep.ts#L10)

Extract text blocks from output that contain a pattern.
Splits by blank lines (how linter/compiler output is structured),
returns only blocks matching the pattern.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `output` | `string` |
| `pattern` | `string` |

## Returns

`string`

## Example

```ts
expect(grep(result.stdout, "unused-var.ts")).toContain("no-unused-vars")
expect(grep(result.stdout, "valid/sorted.ts")).not.toContain("sort-imports")
```
