# Interface: ServerPort

Defined in: [specification/ports/server.port.ts:14](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/server.port.ts#L14)

Abstract server interface for specification runners.
Integration mode uses in-process app, E2E mode uses real HTTP.

## Methods

### request()

```ts
request(
   method,
   path,
body?): Promise<ServerResponse>;
```

Defined in: [specification/ports/server.port.ts:16](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/server.port.ts#L16)

Send an HTTP request and return the response.

#### Parameters

| Parameter | Type      |
| --------- | --------- |
| `method`  | `string`  |
| `path`    | `string`  |
| `body?`   | `unknown` |

#### Returns

`Promise`\<[`ServerResponse`](ServerResponse.md)\>
