# 05 — Getting started

`@jterrazz/test` is a testing framework built on vitest. You describe what to test — an HTTP API, a CLI, a page, a module against a real database — and it starts what that needs, runs one action, and hands back a result you compare with `expect()`. This chapter covers the five ideas behind it, a first spec from install to green, and the question that picks the kind of test you write.

## Why it exists

Three things make a test suite expensive to keep, and the framework takes each one off your hands.

- **Infrastructure is code you maintain.** A suite that needs Postgres, a built binary or a browser usually grows its own `beforeAll` that starts them and an `afterAll` that sometimes forgets to stop them. Here you declare `postgres()`, `specification.cli(bin)` or a page visit, and the framework starts it, isolates it per worker and cleans it up.
- **Assertions drift from what the user sees.** A test that checks `status === 201` and one field passes when the body is wrong. Here a result is compared whole — the full response, the full table, the full output — written in the test or in a file next to it, with `{{tokens}}` where values move.
- **Every repository invents its own layout.** Here the conventions are a linter: where a test lives, what it may import and how it is named are checked by an oxlint plugin and a checker, and every finding says what it found, why the rule exists, how to fix this case, and where to read more.

## The mental model

Five ideas cover everything else in the manual. They match the four families of the docs map, plus the files a test stands on.

**1. A kind of test, and its runner.** What you test decides the kind: a module, a module against a real service (integration), a rendered component, a website, a mobile screen, an HTTP API, a job, a CLI, or the lint rules a project ships. Each kind except module and component has a constructor — `specification.api()`, `specification.cli()`, … — called once per suite in a `*.specification.ts` file. It starts what the suite needs and returns a runner (`api`, `cli`, …) and a `cleanup` you pass to `afterAll`. The chapters call the code behind one kind a **facet**.

**2. A chain: setups, then one action.** Every test is one chain on that runner: zero or more setups (`.seed()`, `.intercept()`, `.clock()`, `.env()` …), then exactly one action (`.get()`, `.exec()`, `.visit()`, `.trigger()`, `.call()` …), which resolves to a result. The chain reads as the test's sentence — the setups are the Given, the action is the When.

```typescript
const result = await api.seed(file('./_seeds/two-users.sql')).get('/users');
```

**3. What surrounds the subject.** A subject rarely runs alone. Real services (`postgres()`, `redis()`, `sqlite()`, `process()`) are started for you; the network is declared with stubs (`defineStub`, `.intercept()`); time is pinned with `clock`; a port your code injects is doubled with `mockOf()`. These have an order of preference, the doubles ladder: use the real thing first, a declared service next, then a stub, and a typed double last.

**4. A visitor, for anything on a screen.** A page, a component or a native app is driven the way a person uses it: `visitor.click(button('Subscribe'))`, `visitor.see(content('Thanks'))`. Elements are found by role and accessible name, never by CSS selector.

**5. Expectations on the whole result.** A result exposes what the action produced — `result.response`, `result.stdout`, `result.table('users')`, `result.tree` — and one matcher, `toMatch`, compares it whole: against a value written in the test, or `file('./_expected/…')` when several tests share it. Values that change between runs are written as tokens (`{{uuid}}`, `{{iso8601}}`), and `TEST_UPDATE=1` writes the expected values for you to review.

The whole-value comparison is the framework's `toMatch` on a framework result (`result.response`, `result.stdout`). On a plain string such as `result.stdout.text`, `toMatch` is vitest's own substring or RegExp check ([21 — Assertions § Common mistakes](21-assertions.md#common-mistakes)).

Everything a test stands on sits in a folder next to it whose name starts with `_`: `_seeds/` (SQL), `_requests/` (what is sent), `_fixtures/` (files the program reads), `_expected/` (what is compared), `_setup/` (helper code). The `_` marks a folder that is not a subject of the tests.

## A first spec

This walkthrough tests an HTTP API backed by SQLite, so it needs no Docker. It assumes a Hono app in `src/app.ts`, built by a `createApp({ databaseUrl })` function, and a schema in `schema.sql`.

### 1. Install

```bash
npm install -D @jterrazz/test @jterrazz/typescript vitest better-sqlite3
```

`vitest` and `@jterrazz/typescript` are always required. Everything else is installed only when a test needs it — here `better-sqlite3` for `sqlite()`. If one is missing, the error says which package and the install command. The full list is [06 — Setting up § What to install](06-setting-up.md#what-to-install).

### 2. Configure vitest

```typescript
// jterrazz.config.ts
import { test } from '@jterrazz/test/config';
import { defineConfig } from '@jterrazz/typescript/config';

export default defineConfig({
    kind: 'api',
    platform: 'node',
    presets: [test()],
    test: { projects: [{ facet: 'unit' }, { facet: 'api' }] },
});
```

Then `npx typescript fix` writes the `vitest.config.ts` those projects derive, a line you never edit. The preset sets the shared defaults (timeouts, artefact paths, no retries), and each project is built by the helper its `facet` names: `unit` collects the `*.test.ts` files next to your modules, `api` collects `specs/api/**/*.spec.ts`. [06 — Setting up](06-setting-up.md#the-vitest-config) lists every helper and default.

This `api` project only names a vitest project. The `api` you send requests with is a different thing: the runner that step 3 builds.

### 3. Build the runner, once per suite

```typescript
// specs/api/api.specification.ts
import { specification, sqlite } from '@jterrazz/test';
import { afterAll } from 'vitest';

import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({
    services: { db: sqlite({ init: './schema.sql' }) },
    server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
});

afterAll(cleanup);
```

`server` returns your app: any object with a `request()` method, which a Hono `app` is. The app runs in the test process, wired to a real SQLite database built from `schema.sql`. Each worker gets its own copy, and every chain starts from empty tables.

### 4. Write the test

```typescript
// specs/api/users/list/shape.spec.ts
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('shape', () => {
    test('lists the users the database holds', async () => {
        // Given - two users, from the seed beside the test
        const result = await api.seed(file('./_seeds/two-users.sql')).get('/users');

        // Then - the whole response
        expect(result.response).toMatch(`
            HTTP/1.1 200 OK
            content-type: application/json

            {"users": [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]}
        `);
    });
});
```

```sql
-- specs/api/users/list/_seeds/two-users.sql
INSERT INTO users (name) VALUES ('Alice'), ('Bob');
```

The folder says what is tested (`users/list/` is `GET /users`), the file name says which question is asked of it (`shape`), and the one `describe` repeats it. Every test carries a `// Given -` and a `// Then -` line.

### 5. Run it

```bash
npx vitest --run --project api
```

The api project also checks route coverage: after the last test it names every route the app declares that no request reached, and a route left unreached fails the run, even on the first one. To accept that debt for now, run once with `TEST_UPDATE=1`: it records the count in `.jterrazz/baseline.json`, which you commit, and the count can only go down from there ([12 — API specs § Route coverage](12-api.md#route-coverage)).

To write the expected value instead of typing it, leave it empty — `toMatch('')` — and run once with `TEST_UPDATE=1`. The framework writes what came back into the test, with tokens where values move; you read the diff before you commit it ([22 — Tokens § Update mode](22-tokens.md#update-mode-tokens-are-preserved)).

### 6. Turn the conventions on

The rules that keep the layout above consistent are a preset of `@jterrazz/typescript`. List it once and `npx typescript check` enforces them — [06 — Setting up § Turning the conventions on](06-setting-up.md#turning-the-conventions-on).

## Which kind of test

Ask the questions in order: the first yes is the kind, and the kind decides where the file lives, which constructor it uses and which vitest project runs it.

<!-- GENERATED:fork — do not edit by hand; run `npm run docs`. Source: lint/consumer/catalogue/fork.ts -->

| Question                                                               | Kind             | Lives at                                         | Constructor                   | Project       | Read                                                                       |
| ---------------------------------------------------------------------- | ---------------- | ------------------------------------------------ | ----------------------------- | ------------- | -------------------------------------------------------------------------- |
| Does it render in a browser as a whole served page?                    | website          | `specs/website/<domain>/<aspect>.spec.ts`        | `specification.website()`     | `website`     | [10](10-website.md)                                                        |
| Does it render as a component (React, a DOM function, a hook)?         | component        | `<file>.test.tsx` beside `<file>.tsx`            | none — the `component` chain  | `component`   | [09](09-component.md)                                                      |
| Does it render on a simulator?                                         | mobile           | `specs/mobile/<domain>/<aspect>.spec.ts`         | `specification.mobile()`      | `mobile`      | [11](11-mobile.md)                                                         |
| Does it answer HTTP?                                                   | api              | `specs/api/<resource>/<action>/<aspect>.spec.ts` | `specification.api()`         | `api`         | [12](12-api.md)                                                            |
| Is it triggered by name, in-process?                                   | job              | `specs/job/<job>/<aspect>.spec.ts`               | `specification.job()`         | `job`         | [13](13-job.md)                                                            |
| Is it a binary?                                                        | cli              | `specs/cli/<command>/` (+ `<case>.spec.yaml`)    | `specification.cli(bin)`      | `cli`         | [14](14-cli.md), [15](15-documents.md)                                     |
| Is it a rule the project ships — a plugin, a checker, a preset?        | lint             | `specs/lint/<rule>/<aspect>.spec.ts`             | `specification.lint()`        | `lint`        | [16](16-lint.md)                                                           |
| Is it a module that needs a real service, or whose oracle is a golden? | integration      | `specs/integration/<domain>/<aspect>.spec.ts`    | `specification.integration()` | `integration` | [08](08-integration.md)                                                    |
| Is it a module alone?                                                  | module           | `<file>.test.ts` beside `<file>.ts`              | none                          | `unit`        | [07](07-module-tests.md)                                                   |
| Is it the repository itself — a suite over several apps?               | repository suite | `specs/<suite>/<domain>/<aspect>.test.ts`        | none                          | any name      | [23 § The third door](23-conventions.md#the-third-door-a-repository-suite) |

<!-- /GENERATED:fork -->

The order matters: a page served over HTTP is a website, not an API, because the first question already caught it. And the table is total — a folder under `specs/` is a kind's name, `_shared/`, or a repository suite; a probe of an adapter against a real database is an integration spec like any other.

The file suffix tells the kind apart: `.test.ts` or `.test.tsx` next to the code for a single unit, `.spec.ts` under `specs/<kind>/` for an assembled product, `<case>.spec.yaml` for a CLI session written as data, and `<kind>.specification.ts` for the file that builds a runner. The kind follows the subject, not the amount of machinery: a component needs a real browser and still sits next to its code, because it is one unit; a module that needs a real database sits under `specs/integration/`, because it is assembled with that database.

Before choosing a kind, ask whether the test should exist at all. A behaviour a user relies on is tested end to end, through the surface the user meets; a module test is kept only for a pure algorithm or a failure no end-to-end path can provoke — [23 — Conventions § Which test earns its place](23-conventions.md#which-test-earns-its-place).

## Where to go next

- The chapter of your kind, from the table above. Each one has the same sections: what it specifies, the constructor, the chain, the result, what is unique to it, pitfalls.
- What surrounds a subject: [17 — Stubs](17-stubs.md), [18 — Services](18-services.md), [19 — Time and doubles](19-time-and-doubles.md).
- Acting on a screen: [20 — The visitor](20-visitor.md).
- Judging a result: [21 — Assertions](21-assertions.md), [22 — Tokens](22-tokens.md).
- Why the conventions are what they are: [23 — Conventions](23-conventions.md); every rule, generated from the code: [24 — Linting](24-linting.md).
