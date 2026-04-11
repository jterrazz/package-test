# Interface: DatabasePort

Defined in: [specification/ports/database.port.ts:5](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/database.port.ts#L5)

Abstract database interface for specification runners.
Implement this to plug in your database stack.

## Methods

### query()

```ts
query(table, columns): Promise<unknown[][]>;
```

Defined in: [specification/ports/database.port.ts:10](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/database.port.ts#L10)

Query a table and return rows as arrays of values.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `table` | `string` |
| `columns` | `string`[] |

#### Returns

`Promise`\<`unknown`[][]\>

***

### reset()

```ts
reset(): Promise<void>;
```

Defined in: [specification/ports/database.port.ts:13](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/database.port.ts#L13)

Reset database to clean state between tests.

#### Returns

`Promise`\<`void`\>

***

### seed()

```ts
seed(sql): Promise<void>;
```

Defined in: [specification/ports/database.port.ts:7](https://github.com/jterrazz/package-test/blob/b137209cf84f883c81d2474187f75c6a19108275/src/specification/ports/database.port.ts#L7)

Execute raw SQL (for seeding test data).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `sql` | `string` |

#### Returns

`Promise`\<`void`\>
