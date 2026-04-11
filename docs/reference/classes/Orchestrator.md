# Class: Orchestrator

Defined in: [infrastructure/orchestrator.ts:29](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L29)

Orchestrator for test infrastructure.
Integration: starts services via testcontainers.
E2E: runs full docker compose up.

## Constructors

### Constructor

```ts
new Orchestrator(options): Orchestrator;
```

Defined in: [infrastructure/orchestrator.ts:38](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L38)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | `OrchestratorOptions` |

#### Returns

`Orchestrator`

## Methods

### getAppUrl()

```ts
getAppUrl(): string | null;
```

Defined in: [infrastructure/orchestrator.ts:246](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L246)

Get app URL from compose (e2e mode).

#### Returns

`string` \| `null`

***

### getDatabase()

```ts
getDatabase(serviceName?): DatabasePort | null;
```

Defined in: [infrastructure/orchestrator.ts:216](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L216)

Get a database service by compose name, or the first one if no name given.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `serviceName?` | `string` |

#### Returns

[`DatabasePort`](../interfaces/DatabasePort.md) \| `null`

***

### getDatabases()

```ts
getDatabases(): Map<string, DatabasePort>;
```

Defined in: [infrastructure/orchestrator.ts:232](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L232)

Get all database services keyed by compose name.

#### Returns

`Map`\<`string`, [`DatabasePort`](../interfaces/DatabasePort.md)\>

***

### start()

```ts
start(): Promise<void>;
```

Defined in: [infrastructure/orchestrator.ts:49](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L49)

Start declared services via testcontainers (integration mode).
Phase 1: start all containers in parallel (the slow part).
Phase 2: wire connections, healthcheck, and init sequentially (fast).

#### Returns

`Promise`\<`void`\>

***

### startCompose()

```ts
startCompose(): Promise<void>;
```

Defined in: [infrastructure/orchestrator.ts:152](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L152)

Start full docker compose stack (e2e mode).
Auto-detects infra services and creates handles for them.

#### Returns

`Promise`\<`void`\>

***

### stop()

```ts
stop(): Promise<void>;
```

Defined in: [infrastructure/orchestrator.ts:138](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L138)

Stop testcontainers (integration mode).

#### Returns

`Promise`\<`void`\>

***

### stopCompose()

```ts
stopCompose(): Promise<void>;
```

Defined in: [infrastructure/orchestrator.ts:205](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/orchestrator.ts#L205)

Stop docker compose stack (e2e mode).

#### Returns

`Promise`\<`void`\>
