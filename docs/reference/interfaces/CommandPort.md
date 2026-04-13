# Interface: CommandPort

Defined in: [specification/ports/command.port.ts:30](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/command.port.ts#L30)

Abstract CLI interface for specification runners.
Implement this to plug in your command execution strategy.

## Methods

### exec()

```ts
exec(
   args,
   cwd,
env?): Promise<CommandResult>;
```

Defined in: [specification/ports/command.port.ts:32](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/command.port.ts#L32)

Execute a CLI command with the given arguments in the given working directory.

#### Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `args`    | `string`                                      |
| `cwd`     | `string`                                      |
| `env?`    | [`CommandEnv`](../type-aliases/CommandEnv.md) |

#### Returns

`Promise`\<[`CommandResult`](CommandResult.md)\>

---

### spawn()

```ts
spawn(
   args,
   cwd,
   options,
env?): Promise<CommandResult>;
```

Defined in: [specification/ports/command.port.ts:35](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/command.port.ts#L35)

Spawn a long-running process and wait for a pattern or timeout.

#### Parameters

| Parameter | Type                                          |
| --------- | --------------------------------------------- |
| `args`    | `string`                                      |
| `cwd`     | `string`                                      |
| `options` | [`SpawnOptions`](SpawnOptions.md)             |
| `env?`    | [`CommandEnv`](../type-aliases/CommandEnv.md) |

#### Returns

`Promise`\<[`CommandResult`](CommandResult.md)\>
