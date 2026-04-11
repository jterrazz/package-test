# Function: cli()

```ts
function cli(options): Promise<SpecificationRunnerWithCleanup>;
```

Defined in: [specification/index.ts:176](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L176)

Create a CLI specification runner.
Runs CLI commands against fixture projects. Optionally starts infrastructure.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`CliOptions`](../interfaces/CliOptions.md) |

## Returns

`Promise`\<[`SpecificationRunnerWithCleanup`](../interfaces/SpecificationRunnerWithCleanup.md)\>

## Example

```ts
export const spec = await cli({
    command: resolve(import.meta.dirname, "../../bin/my-cli.sh"),
    root: "../fixtures",
});
```
