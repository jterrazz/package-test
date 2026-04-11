# Interface: ServiceHandle

Defined in: [infrastructure/services/service.port.ts:7](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L7)

A service handle — returned by factory functions like postgres(), redis().
Mutable: connectionString is populated after the orchestrator starts containers.

## Properties

### composeName

```ts
readonly composeName: string | null;
```

Defined in: [infrastructure/services/service.port.ts:12](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L12)

Compose service name (if linked).

***

### connectionString

```ts
connectionString: string;
```

Defined in: [infrastructure/services/service.port.ts:24](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L24)

Connection string — populated after start.

***

### defaultImage

```ts
readonly defaultImage: string;
```

Defined in: [infrastructure/services/service.port.ts:18](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L18)

Default Docker image for this service type.

***

### defaultPort

```ts
readonly defaultPort: number;
```

Defined in: [infrastructure/services/service.port.ts:15](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L15)

Default container port for this service type.

***

### environment

```ts
readonly environment: Record<string, string>;
```

Defined in: [infrastructure/services/service.port.ts:21](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L21)

Environment variables to pass to the container.

***

### started

```ts
started: boolean;
```

Defined in: [infrastructure/services/service.port.ts:27](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L27)

Whether this service has been started.

***

### type

```ts
readonly type: string;
```

Defined in: [infrastructure/services/service.port.ts:9](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L9)

Service type identifier.

## Methods

### buildConnectionString()

```ts
buildConnectionString(host, port): string;
```

Defined in: [infrastructure/services/service.port.ts:30](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L30)

Build the connection string from host and port.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `host` | `string` |
| `port` | `number` |

#### Returns

`string`

***

### createDatabaseAdapter()

```ts
createDatabaseAdapter(): DatabasePort | null;
```

Defined in: [infrastructure/services/service.port.ts:33](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L33)

Create a DatabasePort adapter (if this is a database). Returns null otherwise.

#### Returns

[`DatabasePort`](DatabasePort.md) \| `null`

***

### healthcheck()

```ts
healthcheck(): Promise<void>;
```

Defined in: [infrastructure/services/service.port.ts:36](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L36)

Verify the service is ready and accepting connections. Throws with context if not.

#### Returns

`Promise`\<`void`\>

***

### initialize()

```ts
initialize(composeDir): Promise<void>;
```

Defined in: [infrastructure/services/service.port.ts:39](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L39)

Run initialization scripts (e.g., init.sql). Throws with SQL error context if it fails.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `composeDir` | `string` |

#### Returns

`Promise`\<`void`\>

***

### reset()

```ts
reset(): Promise<void>;
```

Defined in: [infrastructure/services/service.port.ts:42](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/service.port.ts#L42)

Reset state between tests (truncate tables, flush cache, etc.)

#### Returns

`Promise`\<`void`\>
