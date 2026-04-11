# Interface: DirectoryAccessor

Defined in: [specification/specification.ts:111](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L111)

## Methods

### files()

```ts
files(options?): Promise<string[]>;
```

Defined in: [specification/specification.ts:160](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L160)

List all files in the directory (recursive, sorted, ignoring defaults).
Useful for ad-hoc assertions when you don't want a full snapshot.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | \{ `ignore?`: `string`[]; \} |
| `options.ignore?` | `string`[] |

#### Returns

`Promise`\<`string`[]\>

***

### toMatchFixture()

```ts
toMatchFixture(name, options?): Promise<void>;
```

Defined in: [specification/specification.ts:125](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L125)

Compare the directory tree against `expected/{name}/` (relative to the test file).
On mismatch, throws with a structured diff. With update mode enabled, the
fixture is overwritten with the current contents instead.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `name` | `string` |
| `options` | [`DirectorySnapshotOptions`](DirectorySnapshotOptions.md) |

#### Returns

`Promise`\<`void`\>
