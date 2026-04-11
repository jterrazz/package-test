# Class: ExecAdapter

Defined in: [specification/adapters/exec.adapter.ts:32](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/exec.adapter.ts#L32)

Executes CLI commands via execSync (blocking) or spawn (long-running).
Used by cli() for local command execution.

## Implements

- [`CommandPort`](../interfaces/CommandPort.md)

## Constructors

### Constructor

```ts
new ExecAdapter(command): ExecAdapter;
```

Defined in: [specification/adapters/exec.adapter.ts:35](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/exec.adapter.ts#L35)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `command` | `string` |

#### Returns

`ExecAdapter`

## Methods

### exec()

```ts
exec(
   args, 
   cwd, 
extraEnv?): Promise<CommandResult>;
```

Defined in: [specification/adapters/exec.adapter.ts:39](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/exec.adapter.ts#L39)

Execute a CLI command with the given arguments in the given working directory.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | `string` |
| `cwd` | `string` |
| `extraEnv?` | [`CommandEnv`](../type-aliases/CommandEnv.md) |

#### Returns

`Promise`\<[`CommandResult`](../interfaces/CommandResult.md)\>

#### Implementation of

[`CommandPort`](../interfaces/CommandPort.md).[`exec`](../interfaces/CommandPort.md#exec)

***

### spawn()

```ts
spawn(
   args, 
   cwd, 
   options, 
extraEnv?): Promise<CommandResult>;
```

Defined in: [specification/adapters/exec.adapter.ts:59](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/exec.adapter.ts#L59)

Spawn a long-running process and wait for a pattern or timeout.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | `string` |
| `cwd` | `string` |
| `options` | [`SpawnOptions`](../interfaces/SpawnOptions.md) |
| `extraEnv?` | [`CommandEnv`](../type-aliases/CommandEnv.md) |

#### Returns

`Promise`\<[`CommandResult`](../interfaces/CommandResult.md)\>

#### Implementation of

[`CommandPort`](../interfaces/CommandPort.md).[`spawn`](../interfaces/CommandPort.md#spawn)
