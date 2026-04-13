# Writing tests

## The Given / Then convention

Every test uses `// Given` and `// Then` comments. Always both, never one without the other.

```typescript
test('creates a user and returns 201', async () => {
    // Given — two existing users
    const result = await spec('creates user')
        .seed('initial-users.sql')
        .post('/users', 'new-user.json')
        .run();

    // Then — user created with all three in table
    expect(result.status).toBe(201);
    await result.table('users').toMatch({
        columns: ['name'],
        rows: [['Alice'], ['Bob'], ['Charlie']],
    });
});
```

`// When` is only used if the action is non-obvious. The spec builder chain (`.seed().post().run()` / `.project().exec().run()`) IS the when.

## Directory structure

```
tests/
├── e2e/                    # Full-stack specification tests
│   └── {feature}/
│       ├── {feature}.e2e.test.ts
│       ├── seeds/          # Database state setup
│       ├── fixtures/       # Files copied into CLI working dir
│       ├── requests/       # HTTP request bodies
│       ├── responses/      # Expected HTTP responses
│       └── expected/       # Expected CLI output / directory snapshots
├── integration/            # Infrastructure tests
└── setup/                  # Specification runners, fixtures, helpers
    ├── fixtures/
    ├── helpers/
    └── *.specification.ts  # Runner setup files
```

## File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

## Assertions

Raw result properties use vitest `expect()`. Structured assertions (database, response, directory) use the custom async methods documented in the [API reference](/reference/).

```typescript
// Raw (vitest expect)
expect(result.exitCode).toBe(0);
expect(result.stdout).toContain('Build completed');
expect(result.file('dist/index.js').exists).toBe(true);

// Structured (custom)
await result.table('users').toMatch({ columns: ['name'], rows: [['Alice']] });
result.response.toMatchFile('expected.json');
await result.directory('out').toMatchFixture('scaffold-output');
```
