# Class: DockerAssertion

Defined in: [infrastructure/docker/docker-assertion.ts:4](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L4)

Fluent assertion builder for Docker containers

## Constructors

### Constructor

```ts
new DockerAssertion(container): DockerAssertion;
```

Defined in: [infrastructure/docker/docker-assertion.ts:7](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L7)

#### Parameters

| Parameter   | Type                                                          |
| ----------- | ------------------------------------------------------------- |
| `container` | [`DockerContainerPort`](../interfaces/DockerContainerPort.md) |

#### Returns

`DockerAssertion`

## Methods

### exec()

```ts
exec(cmd): Promise<string>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:100](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L100)

Execute a command and return output for custom assertions

#### Parameters

| Parameter | Type       |
| --------- | ---------- |
| `cmd`     | `string`[] |

#### Returns

`Promise`\<`string`\>

---

### getLogs()

```ts
getLogs(tail?): Promise<string>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:114](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L114)

Get logs for custom assertions

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `tail?`   | `number` |

#### Returns

`Promise`\<`string`\>

---

### readFile()

```ts
readFile(path): Promise<string>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:105](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L105)

Read a file for custom assertions

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `path`    | `string` |

#### Returns

`Promise`\<`string`\>

---

### toBeRunning()

```ts
toBeRunning(): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:12](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L12)

Assert the container is running

#### Returns

`Promise`\<`DockerAssertion`\>

---

### toHaveCpuQuota()

```ts
toHaveCpuQuota(quota): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:91](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L91)

Assert CPU quota

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `quota`   | `number` |

#### Returns

`Promise`\<`DockerAssertion`\>

---

### toHaveDirectory()

```ts
toHaveDirectory(path): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:53](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L53)

Assert a directory exists

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `path`    | `string` |

#### Returns

`Promise`\<`DockerAssertion`\>

---

### toHaveFile()

```ts
toHaveFile(path, opts?): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:30](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L30)

Assert a file exists inside the container

#### Parameters

| Parameter          | Type                           |
| ------------------ | ------------------------------ |
| `path`             | `string`                       |
| `opts?`            | \{ `containing?`: `string`; \} |
| `opts.containing?` | `string`                       |

#### Returns

`Promise`\<`DockerAssertion`\>

---

### toHaveMemoryLimit()

```ts
toHaveMemoryLimit(bytes): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:82](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L82)

Assert memory limit

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `bytes`   | `number` |

#### Returns

`Promise`\<`DockerAssertion`\>

---

### toHaveMount()

```ts
toHaveMount(destination): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:62](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L62)

Assert a mount exists

#### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `destination` | `string` |

#### Returns

`Promise`\<`DockerAssertion`\>

---

### toHaveNetwork()

```ts
toHaveNetwork(mode): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:73](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L73)

Assert network mode

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `mode`    | `string` |

#### Returns

`Promise`\<`DockerAssertion`\>

---

### toNotExist()

```ts
toNotExist(): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:21](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L21)

Assert the container is NOT running / doesn't exist

#### Returns

`Promise`\<`DockerAssertion`\>

---

### toNotHaveFile()

```ts
toNotHaveFile(path): Promise<DockerAssertion>;
```

Defined in: [infrastructure/docker/docker-assertion.ts:44](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-assertion.ts#L44)

Assert a file does NOT exist

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `path`    | `string` |

#### Returns

`Promise`\<`DockerAssertion`\>
