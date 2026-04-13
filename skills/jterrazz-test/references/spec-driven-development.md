# Spec-driven development

> Conventions for using `@jterrazz/test` to drive feature development. These are project rules, not framework features.

## Core principle

Every public behavior is defined by a specification test. **The spec IS the source of truth** — write the spec first, then the code.

## Coverage rules

- Every command, endpoint, feature gets a spec.
- Every spec covers: **success case**, **edge cases**, **error cases with error messages**.
- Error cases are as important as happy paths — test that failures produce useful output.
- Error tests live in their domain folder (seeding errors in `seeding/`, NOT a separate `errors/`).

## When to use which mode

### API projects (HTTP services with infrastructure)

| Mode                                     | Purpose                                                        | Scope                                                                  |
| ---------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `integration` (`describe.each(runners)`) | Development workhorse — fast, real containers, in-process Hono | All specs — every endpoint, DB state, error                            |
| `e2e` (`describe.each(runners)`)         | CI validation — full docker compose, real HTTP                 | Critical paths only — core flows, cross-service, deployment confidence |

Write specs once with `describe.each(runners)`. Integration runs everything. E2E runs the same specs but only the critical subset (e2e is compute-heavy — focus on what ONLY e2e can catch: real HTTP, cross-container networking, compose orchestration).

To split: use `runners` for shared specs, use `integrationSpec` directly for integration-only detailed tests.

```typescript
// Shared — runs in BOTH integration AND e2e
describe.each(runners)("$name — users", ({ spec }) => {
  test("creates a user", async () => { ... });           // critical path — both modes
  test("lists all users", async () => { ... });          // critical path — both modes
});

// Integration-only — detailed edge cases (fast, no e2e needed)
describe("integration — users edge cases", () => {
  test("rejects duplicate email", async () => { ... });
  test("handles empty request body", async () => { ... });
  test("returns 404 for nonexistent user", async () => { ... });
});
```

### CLI projects (build tools, linters, formatters, scaffolding)

| Mode    | Purpose                                | Scope                                           |
| ------- | -------------------------------------- | ----------------------------------------------- |
| `cli()` | Every command, every flag, every error | All specs — success, edge cases, error messages |

CLI tests run the real binary — they're inherently e2e. No split needed. Test every command with every meaningful variation.

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

## Runner pattern with `describe.each`

```typescript
// tests/setup/runners.ts
import { integrationSpec } from "./integration.specification.js";
import { e2eSpec } from "./e2e.specification.js";

export const runners = [
  { name: "integration", spec: integrationSpec },
  { name: "e2e", spec: e2eSpec },
];

// tests/e2e/users/users.e2e.test.ts
import { runners } from "../../setup/runners.js";

describe.each(runners)("$name — users", ({ spec }) => {
  test("creates a user", async () => { ... });
});
```

## Test structure

```
tests/
├── e2e/                    # Full-stack specification tests
│   └── {feature}/
│       ├── {feature}.e2e.test.ts
│       ├── seeds/          # Database state setup (.sql)
│       ├── fixtures/       # Files copied into CLI working dir
│       ├── requests/       # HTTP request bodies (.json)
│       ├── responses/      # Expected HTTP responses (.json)
│       └── expected/       # Expected CLI output / directory snapshots
├── integration/            # Infrastructure tests (containers)
└── setup/                  # Specification runners, fixtures, helpers
    ├── fixtures/           # Shared fixture projects (for .project())
    ├── helpers/            # Shared test utilities
    └── *.specification.ts  # Runner setup files
```

## File naming

| Type        | Suffix                 | Location              |
| ----------- | ---------------------- | --------------------- |
| Unit        | `.test.ts`             | Colocated with source |
| Integration | `.integration.test.ts` | `tests/integration/`  |
| E2E         | `.e2e.test.ts`         | `tests/e2e/`          |

## Test writing convention — Given / Then

Every test uses `// Given` and `// Then` comments. **Always both, never one without the other.**

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

```typescript
test('builds the project', async () => {
    // Given — sample app project
    const result = await spec('build').project('sample-app').exec('build').run();

    // Then — ESM output with source maps
    expect(result.exitCode).toBe(0);
    expect(result.file('dist/index.js').exists).toBe(true);
    expect(result.file('dist/index.js.map').exists).toBe(true);
});
```

### Rules

- Every test gets `// Given —` and `// Then —` comments. Always both, never one without the other.
- `// Given —` setup context, one short phrase.
- `// When —` only if the action isn't obvious.
- `// Then —` what we verify, one short phrase.
- No `// When` for spec builder — `.seed().post().run()` / `.project().exec().run()` IS the when.
- Error tests belong in their domain folder (seeding errors in `seeding/`, not a separate `errors/`).
