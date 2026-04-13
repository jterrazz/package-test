# Interface: DockerContainerPort

Defined in: [infrastructure/docker/docker-port.ts:1](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L1)

## Methods

### exec()

```ts
exec(cmd): Promise<string>;
```

Defined in: [infrastructure/docker/docker-port.ts:3](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L3)

Execute a command inside the container, return stdout

#### Parameters

| Parameter | Type       |
| --------- | ---------- |
| `cmd`     | `string`[] |

#### Returns

`Promise`\<`string`\>

---

### exists()

```ts
exists(path): Promise<boolean>;
```

Defined in: [infrastructure/docker/docker-port.ts:18](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L18)

Check if a file/directory exists

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `path`    | `string` |

#### Returns

`Promise`\<`boolean`\>

---

### file()

```ts
file(path): Promise<{
  content: string;
  exists: boolean;
}>;
```

Defined in: [infrastructure/docker/docker-port.ts:6](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L6)

Read a file from inside the container

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `path`    | `string` |

#### Returns

`Promise`\<\{
`content`: `string`;
`exists`: `boolean`;
\}\>

---

### inspect()

```ts
inspect(): Promise<DockerInspectResult>;
```

Defined in: [infrastructure/docker/docker-port.ts:15](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L15)

Get full docker inspect JSON

#### Returns

`Promise`\<[`DockerInspectResult`](DockerInspectResult.md)\>

---

### isRunning()

```ts
isRunning(): Promise<boolean>;
```

Defined in: [infrastructure/docker/docker-port.ts:9](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L9)

Check if container is running

#### Returns

`Promise`\<`boolean`\>

---

### logs()

```ts
logs(tail?): Promise<string>;
```

Defined in: [infrastructure/docker/docker-port.ts:12](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/docker/docker-port.ts#L12)

Get container logs

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `tail?`   | `number` |

#### Returns

`Promise`\<`string`\>
