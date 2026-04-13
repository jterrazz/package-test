# Interface: IntegrationOptions

Defined in: [specification/index.ts:74](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L74)

## Properties

### app

```ts
app: () => HonoApp;
```

Defined in: [specification/index.ts:76](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L76)

Factory that returns a Hono app — called after services start.

#### Returns

`HonoApp`

---

### root?

```ts
optional root?: string;
```

Defined in: [specification/index.ts:78](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L78)

Project root for compose detection (relative paths supported).

---

### services

```ts
services: ServiceHandle[];
```

Defined in: [specification/index.ts:80](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/index.ts#L80)

Declared services — started via testcontainers.
