# Interface: SpecificationResult

Defined in: [specification/specification.ts:186](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L186)

## Accessors

### exitCode

#### Get Signature

```ts
get exitCode(): number;
```

Defined in: [specification/specification.ts:212](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L212)

##### Returns

`number`

---

### response

#### Get Signature

```ts
get response(): ResponseAccessor;
```

Defined in: [specification/specification.ts:242](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L242)

##### Returns

[`ResponseAccessor`](ResponseAccessor.md)

---

### status

#### Get Signature

```ts
get status(): number;
```

Defined in: [specification/specification.ts:219](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L219)

##### Returns

`number`

---

### stderr

#### Get Signature

```ts
get stderr(): string;
```

Defined in: [specification/specification.ts:233](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L233)

##### Returns

`string`

---

### stdout

#### Get Signature

```ts
get stdout(): string;
```

Defined in: [specification/specification.ts:226](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L226)

##### Returns

`string`

## Methods

### directory()

```ts
directory(path?): DirectoryAccessor;
```

Defined in: [specification/specification.ts:249](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L249)

#### Parameters

| Parameter | Type     | Default value |
| --------- | -------- | ------------- |
| `path`    | `string` | `"."`         |

#### Returns

[`DirectoryAccessor`](DirectoryAccessor.md)

---

### file()

```ts
file(path): FileAccessor;
```

Defined in: [specification/specification.ts:254](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L254)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `path`    | `string` |

#### Returns

[`FileAccessor`](FileAccessor.md)

---

### table()

```ts
table(tableName, options?): TableAssertion;
```

Defined in: [specification/specification.ts:269](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L269)

#### Parameters

| Parameter          | Type                        |
| ------------------ | --------------------------- |
| `tableName`        | `string`                    |
| `options?`         | \{ `service?`: `string`; \} |
| `options.service?` | `string`                    |

#### Returns

[`TableAssertion`](TableAssertion.md)
