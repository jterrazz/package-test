# Function: integration()

```ts
function integration(options): Promise<SpecificationRunnerWithCleanup>;
```

Defined in: [specification/index.ts:106](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L106)

Create an integration specification runner.
Starts infra containers via testcontainers, app runs in-process.

## Parameters

| Parameter | Type                                                        |
| --------- | ----------------------------------------------------------- |
| `options` | [`IntegrationOptions`](../interfaces/IntegrationOptions.md) |

## Returns

`Promise`\<[`SpecificationRunnerWithCleanup`](../interfaces/SpecificationRunnerWithCleanup.md)\>
