# Interface: PostgresOptions

Defined in: [infrastructure/services/postgres.ts:8](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/postgres.ts#L8)

## Properties

### compose?

```ts
optional compose?: string;
```

Defined in: [infrastructure/services/postgres.ts:10](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/postgres.ts#L10)

Map to a service in docker-compose.test.yaml.

***

### env?

```ts
optional env?: Record<string, string>;
```

Defined in: [infrastructure/services/postgres.ts:14](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/postgres.ts#L14)

Override environment variables.

***

### image?

```ts
optional image?: string;
```

Defined in: [infrastructure/services/postgres.ts:12](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/postgres.ts#L12)

Override image.
