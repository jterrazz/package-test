# Function: postgres()

```ts
function postgres(options?): PostgresHandle;
```

Defined in: [infrastructure/services/postgres.ts:141](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/postgres.ts#L141)

Create a PostgreSQL service handle.

## Parameters

| Parameter | Type                                                  |
| --------- | ----------------------------------------------------- |
| `options` | [`PostgresOptions`](../interfaces/PostgresOptions.md) |

## Returns

`PostgresHandle`

## Example

```ts
const db = postgres({ compose: 'db' });
// After start: db.connectionString is populated
```
