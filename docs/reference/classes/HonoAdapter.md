# Class: HonoAdapter

Defined in: [specification/adapters/hono.adapter.ts:7](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/hono.adapter.ts#L7)

Server adapter for Hono — in-process requests, no real HTTP.
Used by integration() specification runner.

## Implements

- [`ServerPort`](../interfaces/ServerPort.md)

## Constructors

### Constructor

```ts
new HonoAdapter(app): HonoAdapter;
```

Defined in: [specification/adapters/hono.adapter.ts:12](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/hono.adapter.ts#L12)

#### Parameters

| Parameter     | Type                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| `app`         | \{ `request`: (`path`, `init?`) => `Response` \| `Promise`\<`Response`\>; \} |
| `app.request` | (`path`, `init?`) => `Response` \| `Promise`\<`Response`\>                   |

#### Returns

`HonoAdapter`

## Methods

### request()

```ts
request(
   method,
   path,
body?): Promise<ServerResponse>;
```

Defined in: [specification/adapters/hono.adapter.ts:18](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/hono.adapter.ts#L18)

Send an HTTP request and return the response.

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `method`  | `string`  |
| `path`    | `string`  |
| `body?`   | `unknown` |

#### Returns

`Promise`\<[`ServerResponse`](../interfaces/ServerResponse.md)\>

#### Implementation of

[`ServerPort`](../interfaces/ServerPort.md).[`request`](../interfaces/ServerPort.md#request)
