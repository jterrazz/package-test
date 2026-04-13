# Interface: TableAssertion

Defined in: [specification/specification.ts:53](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L53)

## Methods

### toBeEmpty()

```ts
toBeEmpty(): Promise<void>;
```

Defined in: [specification/specification.ts:69](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L69)

#### Returns

`Promise`\<`void`\>

---

### toMatch()

```ts
toMatch(expected): Promise<void>;
```

Defined in: [specification/specification.ts:62](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L62)

#### Parameters

| Parameter          | Type                                                |
| ------------------ | --------------------------------------------------- |
| `expected`         | \{ `columns`: `string`[]; `rows`: `unknown`[][]; \} |
| `expected.columns` | `string`[]                                          |
| `expected.rows`    | `unknown`[][]                                       |

#### Returns

`Promise`\<`void`\>
