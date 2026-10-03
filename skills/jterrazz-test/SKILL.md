---
name: jterrazz-test
description: Testing conventions for @jterrazz projects — the nine kinds (module, integration, component, website, mobile, api, job, cli, lint) plus the repository suite, vitest, real services, golden files, doubles. Use when writing, organizing, or debugging ANY test in a jterrazz repo, a plain module test included.
metadata:
    version: '17'
---

# `@jterrazz/test`

What to decide BEFORE writing a test, and which chapter to read next. Every option, matcher and rule is in the chapter this page sends you to; the types say the API. New to the package: [docs/05 — Getting started](../../docs/05-getting-started.md) has the five ideas and a first spec.

First, whether the test should exist: end to end through the surface a user meets, a published package from its packed tarball; a module test only for a pure algorithm or a failure no end-to-end path provokes ([docs/23 § Which test earns its place](../../docs/23-conventions.md#which-test-earns-its-place)).

## Which kind — ask the fork

Ask in order; the first yes is the kind, and the kind fixes the file, the constructor and the project ([docs/05 § Which kind of test](../../docs/05-getting-started.md#which-kind-of-test) carries the table, and a meta-test holds this list to it).

1. A whole served page in a browser? → **website**, `specs/website/<domain>/<aspect>.spec.ts`
2. A component (React, a DOM function, a hook)? → **component**, `<file>.test.tsx` beside `<file>.tsx`
3. A screen on a simulator? → **mobile**, `specs/mobile/<domain>/<aspect>.spec.ts`
4. Answers HTTP? → **api**, `specs/api/<resource>/<action>/<aspect>.spec.ts` — the folder derived from the route (`GET /events` → `events/list/`)
5. Triggered by name, in-process? → **job**, `specs/job/<job>/<aspect>.spec.ts`
6. A binary? → **cli**, `specs/cli/<command>/<case>.spec.yaml` (or `<aspect>.spec.ts`)
7. A rule the project ships — a plugin, a checker, a preset? → **lint**, `specs/lint/<rule>/<aspect>.spec.ts`; the rule's visitor alone is a module test on `ruleTester()`
8. A module needing a real service, or whose oracle is a golden? → **integration**, `specs/integration/<domain>/<aspect>.spec.ts`
9. A module alone? → **module**, `<file>.test.ts` beside `<file>.ts`
10. The repository itself, a suite over several apps? → **repository suite**, `specs/<suite>/<domain>/<aspect>.test.ts`

A spec file asks ONE question (its name, the aspect — never `misc`) of ONE subject (its folder), in one `describe` titled with the aspect; a colocated `.test.ts(x)` holds one `describe` titled with the export it covers. `typescript fix` splits, moves and retitles ([docs/23 § One file, one subject](../../docs/23-conventions.md#one-file-one-subject)).

## The shape every spec has

```typescript
// specs/api/api.specification.ts — the runner, once per suite, at the facet root
import { afterAll } from 'vitest';
import { postgres, specification } from '@jterrazz/test';

export const { api, cleanup } = await specification.api({
    server: () => ({ request: () => new Response('ok') }),
    services: { db: postgres() },
});

afterAll(cleanup);
```

```typescript
// specs/api/users/create/shape.spec.ts — POST /users
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('shape', () => {
    test('creates a user', async () => {
        // Given - an empty users table
        const result = await api.request(file('./_requests/create-user.http'));

        // Then - the response and the row it wrote
        expect(result.response).toMatch(file('./_expected/user-created.http'));
        await expect(result.table('users')).toMatch([[1, 'Alice']]);
    });
});
```

- One chain: zero or more setups, exactly ONE action; every assertion through `expect()`.
- The runner is destructured under its canonical name, with `afterAll(cleanup)`.
- Every test carries a `// Given -` line, then a `// Then -` line.

## What goes wrong most

- **A bare string where a file is meant** — `.seed('users.sql')` does not compile. Name the disk with `file('./_seeds/users.sql')` or `directory(…)`, relative to the spec, in the test that reads it.
- **A probe where the whole result belongs** — compare a response, a json, a table or an output WHOLE, written in place (``toMatch(`HTTP/1.1 200 OK …`)``) or in `_expected/` when several tests share it; add one precise assertion only if one property is the subject ([docs/21](../../docs/21-assertions.md)).
- **A value that moves** — a `{{token}}`, never a literal; `TEST_UPDATE=1` writes the expected value, then read the diff ([docs/22](../../docs/22-tokens.md)).
- **A double before the real thing** — the real thing → a declared service → a stub (`.intercept()`) → `mockOf<T>()`, the first rung that fits ([docs/19](../../docs/19-time-and-doubles.md#the-doubles-ladder)). A call that must not happen is `http.never(…)` ([docs/17](../../docs/17-stubs.md)).
- **Time** — `clock` only: `.clock('<iso>')` on a chain, `using _ = clock.at('<iso>')` in scope; never `vi.useFakeTimers` ([docs/19](../../docs/19-time-and-doubles.md#the-clock)).
- **A folder that is no subject, spelled without its `_`** — `_setup/`, `_seeds/`, `_requests/`, `_expected/`, `_fixtures/`, and `_shared/` at the specs root are the closed list; what several leaves share sits in the lowest folder they share ([docs/23 § The naming recap](../../docs/23-conventions.md#the-naming-recap)).
- **A partial element name** — names are exact: `link('Articles')` does not reach "Read Articles"; scope with `within(…)` ([docs/20](../../docs/20-visitor.md)).
- **An `expect` in a scenario, a helper or a loop** — a scenario is the When; a helper returns what it reads; a loop asserts nothing over an empty collection.
- **Awaiting a sync matcher, or not awaiting an IO one** — a table, a directory and a page-captured subject are awaited; the types say which.
- **A setting every chain of a file repeats** — state it once, on a view: `const morning = api.with({ clock, headers })` ([docs/23 § What a file shares](../../docs/23-conventions.md#what-a-file-shares)).

## Read next

| The test you are writing, or the question       | Chapter                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| install, the vitest config, the `test()` preset | [docs/06-setting-up.md](../../docs/06-setting-up.md)                                       |
| module                                          | [docs/07-module-tests.md](../../docs/07-module-tests.md)                                   |
| integration                                     | [docs/08-integration.md](../../docs/08-integration.md)                                     |
| component                                       | [docs/09-component.md](../../docs/09-component.md)                                         |
| website                                         | [docs/10-website.md](../../docs/10-website.md)                                             |
| mobile                                          | [docs/11-mobile.md](../../docs/11-mobile.md)                                               |
| api                                             | [docs/12-api.md](../../docs/12-api.md)                                                     |
| job                                             | [docs/13-job.md](../../docs/13-job.md)                                                     |
| cli, and a `<case>.spec.yaml`                   | [docs/14-cli.md](../../docs/14-cli.md), [docs/15-documents.md](../../docs/15-documents.md) |
| lint — a rule over a tree, or alone             | [docs/16-lint.md](../../docs/16-lint.md)                                                   |
| what the network replies                        | [docs/17-stubs.md](../../docs/17-stubs.md)                                                 |
| a database, a cache, a process                  | [docs/18-services.md](../../docs/18-services.md)                                           |
| the clock, a port double                        | [docs/19-time-and-doubles.md](../../docs/19-time-and-doubles.md)                           |
| naming an element on any surface that draws     | [docs/20-visitor.md](../../docs/20-visitor.md)                                             |
| a matcher, sync or awaited                      | [docs/21-assertions.md](../../docs/21-assertions.md)                                       |
| a `{{token}}`, or update mode                   | [docs/22-tokens.md](../../docs/22-tokens.md)                                               |
| why a convention holds, what review judges      | [docs/23-conventions.md](../../docs/23-conventions.md)                                     |
| a rule id, a finding, the ratchet               | [docs/24-linting.md](../../docs/24-linting.md)                                             |
| anything else — the API is the types            | [docs/README.md](../../docs/README.md), the manual's map                                   |
