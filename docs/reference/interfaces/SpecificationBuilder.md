# Interface: SpecificationBuilder

Defined in: [specification/specification.ts:293](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L293)

## Methods

### delete()

```ts
delete(path): this;
```

Defined in: [specification/specification.ts:366](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L366)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `path`    | `string` |

#### Returns

`this`

---

### env()

```ts
env(env): this;
```

Defined in: [specification/specification.ts:344](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L344)

Set environment variables for the CLI process. Merged on top of process.env.
Use `null` to unset a variable. Multiple calls merge.

The token `$WORKDIR` (in any value) is replaced with the actual working
directory at run-time — useful for tests that need a fully isolated `HOME`.

#### Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `env`     | [`CommandEnv`](../type-aliases/CommandEnv.md) |

#### Returns

`this`

#### Example

```ts
spec('...').env({ HOME: '$WORKDIR', TZ: 'UTC' }).exec('status').run();
```

---

### exec()

```ts
exec(args): this;
```

Defined in: [specification/specification.ts:373](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L373)

#### Parameters

| Parameter | Type                   |
| --------- | ---------------------- |
| `args`    | `string` \| `string`[] |

#### Returns

`this`

---

### fixture()

```ts
fixture(file): this;
```

Defined in: [specification/specification.ts:319](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L319)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `file`    | `string` |

#### Returns

`this`

---

### get()

```ts
get(path): this;
```

Defined in: [specification/specification.ts:351](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L351)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `path`    | `string` |

#### Returns

`this`

---

### mock()

```ts
mock(file): this;
```

Defined in: [specification/specification.ts:329](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L329)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `file`    | `string` |

#### Returns

`this`

---

### post()

```ts
post(path, bodyFile?): this;
```

Defined in: [specification/specification.ts:356](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L356)

#### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `path`      | `string` |
| `bodyFile?` | `string` |

#### Returns

`this`

---

### project()

```ts
project(name): this;
```

Defined in: [specification/specification.ts:324](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L324)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `name`    | `string` |

#### Returns

`this`

---

### put()

```ts
put(path, bodyFile?): this;
```

Defined in: [specification/specification.ts:361](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L361)

#### Parameters

| Parameter   | Type     |
| ----------- | -------- |
| `path`      | `string` |
| `bodyFile?` | `string` |

#### Returns

`this`

---

### run()

```ts
run(): Promise<SpecificationResult>;
```

Defined in: [specification/specification.ts:385](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L385)

#### Returns

`Promise`\<[`SpecificationResult`](SpecificationResult.md)\>

---

### seed()

```ts
seed(file, options?): this;
```

Defined in: [specification/specification.ts:314](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L314)

#### Parameters

| Parameter          | Type                        |
| ------------------ | --------------------------- |
| `file`             | `string`                    |
| `options?`         | \{ `service?`: `string`; \} |
| `options.service?` | `string`                    |

#### Returns

`this`

---

### spawn()

```ts
spawn(args, options): this;
```

Defined in: [specification/specification.ts:378](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L378)

#### Parameters

| Parameter | Type                              |
| --------- | --------------------------------- |
| `args`    | `string`                          |
| `options` | [`SpawnOptions`](SpawnOptions.md) |

#### Returns

`this`
