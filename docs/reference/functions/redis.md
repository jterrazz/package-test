# Function: redis()

```ts
function redis(options?): RedisHandle;
```

Defined in: [infrastructure/services/redis.ts:75](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/infrastructure/services/redis.ts#L75)

Create a Redis service handle.

## Parameters

| Parameter | Type                                            |
| --------- | ----------------------------------------------- |
| `options` | [`RedisOptions`](../interfaces/RedisOptions.md) |

## Returns

`RedisHandle`

## Example

```ts
const cache = redis({ compose: 'cache' });
// After start: cache.connectionString is populated
```
