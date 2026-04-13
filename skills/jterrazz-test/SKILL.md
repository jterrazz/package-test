---
name: jterrazz-test
description: Use when writing integration, e2e, or CLI tests with @jterrazz/test. Covers spec runners, directory snapshots, database seeding, fixture projects, and the Given/Then convention.
metadata:
    version: '5.2'
---

# `@jterrazz/test`

The ecosystem's testing framework. One fluent builder, three execution modes. Handles containers, working directories, and cleanup automatically.

## When to use this skill

**Trigger on:**

- Imports of `@jterrazz/test` in source.
- Edits to `*.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts` in repos using this framework.
- Edits under `tests/setup/*.specification.ts`.
- User prompts mentioning specification runners, directory snapshots, test fixtures, seeds, or "given/then" convention.

**Do NOT use this skill for:**

- Plain unit tests that use `vitest` directly without `@jterrazz/test` (e.g. testing a pure function).
- Frontend component tests (use Vitest + Testing Library).
- Browser e2e tests (use Playwright).

## Decision matrix — which runner

| Question                                                                                   | Use this runner                                        |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Is the code under test a Hono app + database, and you want the fastest loop?               | **`integration()`** — testcontainers + in-process Hono |
| Is the service in another language, OR do you need the full deployed stack with real HTTP? | **`e2e()`** — `docker compose up` + real HTTP          |
| Are you testing a CLI binary, scaffolding tool, code generator, or bundler?                | **`cli()`** — child process in a fresh temp dir        |
| Are you testing a Docker container's filesystem / mounts / network mode?                   | `dockerContainer()` (separate API; see live docs)      |

For API services that use both `integration()` and `e2e()`, write specs once with `describe.each(runners)` and run all of them in integration; promote critical-path subset to e2e via a separate `tests/setup/runners.ts` array.

## Quick start

```typescript
// tests/setup/integration.specification.ts
import { afterAll } from 'vitest';
import { integration, postgres } from '@jterrazz/test';
import { createApp } from '../../src/app.js';

const db = postgres({ compose: 'db' });

export const spec = await integration({
    services: [db],
    app: () => createApp({ databaseUrl: db.connectionString }),
    root: '../../',
});

afterAll(() => spec.cleanup());
```

```typescript
// tests/e2e/users/users.e2e.test.ts
import { spec } from '../../setup/integration.specification.js';

test('creates a user', async () => {
    // Given — one existing user
    const result = await spec('creates user')
        .seed('initial-users.sql')
        .post('/users', 'new-user.json')
        .run();

    // Then — user created, table has both
    expect(result.status).toBe(201);
    await result.table('users').toMatch({ columns: ['name'], rows: [['Alice'], ['Bob']] });
});
```

## MUST / MUST NOT

- **MUST** include both `// Given —` and `// Then —` comments on every test. Always both, never one without the other. The spec builder chain (`.seed().post().run()` / `.project().exec().run()`) IS the `// When` — only add `// When —` if the action is non-obvious.
- **MUST** put error tests in their domain folder (seeding errors in `seeding/`, not a separate `errors/`). Cover success, edge cases, AND error paths with their messages.
- **MUST** use `toMatchFile` / `toMatchFixture` for multi-line or structural output (HTTP bodies, generated trees). Vitest `expect(...).toBe(...)` produces ugly diffs for those.
- **MUST** declare every database via the `services` array in the runner setup; `result.table(...)` only works if the runner knows about the DB.
- **MUST NOT** roll your own directory walk + per-file content loop for scaffolding tests — use `result.directory(path).toMatchFixture(name)`.
- **MUST NOT** rely on a CLI spec running inside `fixturesRoot`. As of v5.2.0 every `.exec()` runs in a fresh `mkdtemp` directory; use `.project("name")` to seed it.
- **MUST NOT** mix HTTP actions (`.get`, `.post`, …) and CLI actions (`.exec`, `.spawn`) in the same spec — they're mutually exclusive.

## Common pitfalls

- **"fixture project not found"** → `.project("name")` looks for `{root}/{name}/`, where `root` is set on the `cli({ root })` runner. Confirm both.
- **"fixture not found at expected/..."** → directory snapshot fixtures live at `{test-file-dir}/expected/{name}/`. Run with `JTERRAZZ_TEST_UPDATE=1` to create the baseline.
- **"directory mismatch" with files you don't expect** → pass extra ignores: `toMatchFixture(name, { ignore: [".copier-answers.yml"] })`. Defaults already skip `.git`, `.DS_Store`, `node_modules`, `.next`, `dist`, `.turbo`, `.cache`.
- **CLI test polluting your committed fixtures** → you're on a pre-v5.2 version. Upgrade.

## Deep references (loaded only when needed)

- [api-cheatsheet.md](references/api-cheatsheet.md) — full builder + assertion tables (setup, actions, assertions, multi-db, mocking, grep).
- [spec-driven-development.md](references/spec-driven-development.md) — coverage rules, runner pattern with `describe.each`, file naming, test structure.

## Live docs (canonical)

- Site: <https://jterrazz.github.io/package-test/>
- Full docs as one Markdown file (for agent ingestion): <https://jterrazz.github.io/package-test/llms-full.txt>
- Auto-generated API reference: <https://jterrazz.github.io/package-test/reference/>
- Changelog with migration notes: <https://github.com/jterrazz/package-test/blob/main/CHANGELOG.md>
