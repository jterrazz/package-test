# Interface: SpecificationRunnerWithCleanup()

Defined in: [specification/index.ts:97](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L97)

## Extends

- `SpecificationRunner`

```ts
SpecificationRunnerWithCleanup(label): SpecificationBuilder;
```

Defined in: [specification/index.ts:97](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L97)

## Parameters

| Parameter | Type |
| ------ | ------ |
| `label` | `string` |

## Returns

[`SpecificationBuilder`](SpecificationBuilder.md)

## Properties

### cleanup

```ts
cleanup: () => Promise<void>;
```

Defined in: [specification/index.ts:98](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L98)

#### Returns

`Promise`\<`void`\>

***

### orchestrator

```ts
orchestrator: Orchestrator;
```

Defined in: [specification/index.ts:99](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L99)
