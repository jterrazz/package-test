# Interface: SpawnOptions

Defined in: [specification/ports/command.port.ts:13](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/command.port.ts#L13)

Options for spawning a long-running process.

## Properties

### timeout

```ts
timeout: number;
```

Defined in: [specification/ports/command.port.ts:17](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/command.port.ts#L17)

Kill the process after this many milliseconds.

***

### waitFor

```ts
waitFor: string;
```

Defined in: [specification/ports/command.port.ts:15](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/command.port.ts#L15)

Resolve when stdout/stderr contains this string.
