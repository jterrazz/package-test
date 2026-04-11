# Type Alias: CommandEnv

```ts
type CommandEnv = Record<string, null | string>;
```

Defined in: [specification/ports/command.port.ts:24](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/command.port.ts#L24)

Extra environment variables to set for the child process.
Values are merged on top of process.env. A `null` value unsets the variable.
