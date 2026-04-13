# Function: e2e()

```ts
function e2e(options?): Promise<SpecificationRunnerWithCleanup>;
```

Defined in: [specification/index.ts:135](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L135)

Create an E2E specification runner.
Starts full docker compose stack. App URL and database auto-detected.

## Parameters

| Parameter | Type                                        |
| --------- | ------------------------------------------- |
| `options` | [`E2eOptions`](../interfaces/E2eOptions.md) |

## Returns

`Promise`\<[`SpecificationRunnerWithCleanup`](../interfaces/SpecificationRunnerWithCleanup.md)\>
