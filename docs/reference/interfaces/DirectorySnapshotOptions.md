# Interface: DirectorySnapshotOptions

Defined in: [specification/specification.ts:81](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L81)

## Properties

### ignore?

```ts
optional ignore?: string[];
```

Defined in: [specification/specification.ts:83](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L83)

Extra path segments to ignore (in addition to default: .git, node_modules, etc.).

***

### update?

```ts
optional update?: boolean;
```

Defined in: [specification/specification.ts:88](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/specification.ts#L88)

Force update mode regardless of vitest flags / env vars.
`true` writes the fixture, `false` always asserts. Defaults to auto-detect.
