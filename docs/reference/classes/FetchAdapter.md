# Class: FetchAdapter

Defined in: [specification/adapters/fetch.adapter.ts:7](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/fetch.adapter.ts#L7)

Server adapter for real HTTP — sends actual fetch requests.
Used by e2e() specification runner.

## Implements

- [`ServerPort`](../interfaces/ServerPort.md)

## Constructors

### Constructor

```ts
new FetchAdapter(url): FetchAdapter;
```

Defined in: [specification/adapters/fetch.adapter.ts:10](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/fetch.adapter.ts#L10)

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `url`     | `string` |

#### Returns

`FetchAdapter`

## Methods

### request()

```ts
request(
   method,
   path,
body?): Promise<ServerResponse>;
```

Defined in: [specification/adapters/fetch.adapter.ts:14](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/adapters/fetch.adapter.ts#L14)

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
