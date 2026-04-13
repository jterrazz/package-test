# Interface: CliOptions

Defined in: [specification/index.ts:88](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L88)

## Properties

### command

```ts
command: string;
```

Defined in: [specification/index.ts:90](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L90)

CLI command to run (resolved from node_modules/.bin or PATH).

---

### root?

```ts
optional root?: string;
```

Defined in: [specification/index.ts:92](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L92)

Project root — base dir for .project() fixture lookup (relative paths supported).

---

### services?

```ts
optional services?: ServiceHandle[];
```

Defined in: [specification/index.ts:94](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L94)

Optional infrastructure services (started via testcontainers).
