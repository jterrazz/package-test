# Spec-driven development

> Conventions for using `@jterrazz/test` to drive feature development. These are project rules, not framework features.

## Core principle

Every public behavior is defined by a specification test. **The spec IS the source of truth** - write the spec first, then the code.

## Coverage rules

- Every command, endpoint, feature gets a spec.
- Every spec covers: **success case**, **edge cases**, **error cases with error messages**.
- Error cases are as important as happy paths - test that failures produce useful output.
- Error tests live in their domain folder (seeding errors in `seeding/`, NOT a separate `errors/`).

## When to use which mode

### API projects (HTTP services with infrastructure)

| Mode                           | Purpose                                                        | Scope                                                                  |
| ------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `spec(app(...))` (integration) | Development workhorse - fast, real containers, in-process Hono | All specs - every endpoint, DB state, error                            |
| `spec(stack(...))` (e2e)       | CI validation - full docker compose, real HTTP                 | Critical paths only - core flows, cross-service, deployment confidence |

Write specs once in an `http.specification.ts` file. Select the active runner via the `SPEC_RUNNER` env var. Integration runs everything. E2E runs the same specs but only the critical subset (e2e is compute-heavy - focus on what ONLY e2e can catch: real HTTP, cross-container networking, compose orchestration).

To split: use `SPEC_RUNNER` for shared specs, import the integration runner directly for integration-only detailed tests.

```typescript
// tests/http/http.specification.ts
import { spec, app, stack } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';

const db = postgres({ compose: 'db' });

const runner =
    process.env.SPEC_RUNNER === 'e2e'
        ? await spec(stack('../../'))
        : await spec(
              app(() => createApp({ databaseUrl: db.connectionString })),
              {
                  services: [db],
                  root: '../../',
              },
          );

export { runner };
```

```typescript
// tests/http/users/users.test.ts - runs in BOTH integration AND e2e
import { runner } from '../http.specification.js';

test('creates a user', async () => {
    // Given - one existing user
    const result = await runner('creates user')
        .seed('initial-users.sql')
        .post('/users', 'new-user.json')
        .run();

    // Then - user created
    expect(result.status).toBe(201);
});
```

```typescript
// tests/adapters/users.test.ts - integration-only detailed tests
import { runner } from '../http/http.specification.js';

test('rejects duplicate email', async () => { ... });
test('handles empty request body', async () => { ... });
test('returns 404 for nonexistent user', async () => { ... });
```

### CLI projects (build tools, linters, formatters, scaffolding)

| Mode                 | Purpose                                | Scope                                           |
| -------------------- | -------------------------------------- | ----------------------------------------------- |
| `spec(command(...))` | Every command, every flag, every error | All specs - success, edge cases, error messages |

CLI tests run the real binary - they're inherently e2e. No split needed. Test every command with every meaningful variation.

```
Feature: build command
├── builds successfully (exit 0, output files)
├── generates ESM output with correct content
├── generates type declarations
├── generates source maps
├── does NOT generate CJS output (app mode)
├── fails on missing entry point (meaningful error)
├── fails on invalid TypeScript (meaningful error)
└── fails on missing tsconfig (meaningful error)
```

## Dual-runner pattern with `SPEC_RUNNER`

```typescript
// tests/http/http.specification.ts
import { spec, app, stack } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';

const db = postgres({ compose: 'db' });

export const runner =
    process.env.SPEC_RUNNER === 'e2e'
        ? await spec(stack('../../'))
        : await spec(
              app(() => createApp({ databaseUrl: db.connectionString })),
              {
                  services: [db],
                  root: '../../',
              },
          );
```

```typescript
// tests/http/users/users.test.ts
import { runner } from '../http.specification.js';

test('creates a user', async () => { ... });
```

## Test structure

```
tests/
├── http/                   # HTTP specification tests (shared between integration + e2e)
│   ├── http.specification.ts  # Runner setup with SPEC_RUNNER switch
│   └── {feature}/
│       ├── {feature}.test.ts
│       ├── seeds/          # Database state setup (.sql)
│       ├── fixtures/       # Files copied into working dir
│       ├── requests/       # HTTP request bodies (.json)
│       ├── responses/      # Expected HTTP responses (.json)
│       └── expected/       # Expected directory snapshots
├── cli/                    # CLI specification tests
│   ├── cli.specification.ts
│   └── {feature}/
│       ├── {feature}.test.ts
│       ├── fixtures/       # Files/projects for CLI tests
│       └── expected/       # Expected CLI output / directory snapshots
├── adapters/               # Integration-only detailed tests
└── setup/                  # Shared fixtures, helpers
    ├── fixtures/           # Shared fixture projects (for .project())
    └── helpers/            # Shared test utilities
```

## File naming

| Type       | Suffix     | Location              |
| ---------- | ---------- | --------------------- |
| Unit       | `.test.ts` | Colocated with source |
| HTTP specs | `.test.ts` | `tests/http/`         |
| CLI specs  | `.test.ts` | `tests/cli/`          |
| Adapters   | `.test.ts` | `tests/adapters/`     |

## Test writing convention - Given / Then

Every test uses `// Given` and `// Then` comments. **Always both, never one without the other.**

```typescript
test('creates a user and returns 201', async () => {
    // Given - two existing users
    const result = await runner('creates user')
        .seed('initial-users.sql')
        .post('/users', 'new-user.json')
        .run();

    // Then - user created with all three in table
    expect(result.status).toBe(201);
    await result.table('users').toMatch({
        columns: ['name'],
        rows: [['Alice'], ['Bob'], ['Charlie']],
    });
});
```

```typescript
test('builds the project', async () => {
    // Given - sample app project
    const result = await runner('build').project('sample-app').exec('build').run();

    // Then - ESM output with source maps
    expect(result.exitCode).toBe(0);
    expect(result.file('dist/index.js').exists).toBe(true);
    expect(result.file('dist/index.js.map').exists).toBe(true);
});
```

### Rules

- Every test gets `// Given -` and `// Then -` comments. Always both, never one without the other.
- `// Given -` setup context, one short phrase.
- `// When -` only if the action isn't obvious.
- `// Then -` what we verify, one short phrase.
- No `// When` for spec builder - `.seed().post().run()` / `.project().exec().run()` IS the when.
- Error tests belong in their domain folder (seeding errors in `seeding/`, not a separate `errors/`).
