---
name: studio-test
description: 'Testing conventions for @jterrazz projects: the nine kinds (module, integration, component, website, mobile, api, job, cli, lint) plus the repository suite, vitest, real services, golden files, doubles. Use when writing, organizing, or debugging ANY test in a jterrazz repo, a plain module test included.'
metadata:
    version: '17'
---

# `@jterrazz/test`

What to decide BEFORE writing a test, and which chapter to read next. Every option, matcher and rule is in the chapter this page sends you to; the types say the API. New to the package: [Getting started (docs/start/getting-started.md)](../../docs/start/getting-started.md) has the five ideas and a first spec.

First, whether the test should exist: end to end through the surface a user meets, a published package from its packed tarball; a module test only for a pure algorithm or a failure no end-to-end path provokes ([Conventions § Which test earns its place](../../docs/concepts/conventions.md#which-test-earns-its-place)).

## Which kind: ask the fork

Ask in order; the first yes is the kind, and the kind fixes the file, the constructor and the project ([Getting started § Which kind of test](../../docs/start/getting-started.md#which-kind-of-test) carries the table, and a meta-test holds this list to it).

1. A whole served page in a browser? → **website**, `specs/website/<domain>/<aspect>.spec.ts`
2. A component (React, a DOM function, a hook)? → **component**, `__tests__/<file>.test.tsx` in the folder of `<file>.tsx`
3. A screen on a simulator? → **mobile**, `specs/mobile/<domain>/<aspect>.spec.ts`
4. Answers HTTP, in this process or deployed at a url? → **api**, `specs/api/<resource>/<action>/<aspect>.spec.ts`, the folder derived from the route (`GET /events` gives `events/list/`); `specification.api({ url })` probes a deployed one, where a request that never answers is the result `unreachable: <reason>`, never a throw
5. Triggered by name, in-process? → **job**, `specs/job/<job>/<aspect>.spec.ts`
6. A binary? → **cli**, `specs/cli/<command>/<case>.spec.yaml` (or `<aspect>.spec.ts`)
7. A rule the project ships (a plugin, a checker, a preset)? → **lint**, `specs/lint/<rule>/<aspect>.spec.ts`; the rule's visitor alone is a module test on `ruleTester()`
8. A module needing a real service, or whose oracle is a golden? → **integration**, `specs/integration/<domain>/<aspect>.spec.ts`
9. A module alone? → **module**, `__tests__/<file>.test.ts` in the folder of `<file>.ts`
10. The repository itself, a suite over several apps? → **repository suite**, `specs/<suite>/<domain>/<aspect>.test.ts`

A spec file asks ONE question (its name, the aspect, never `misc`) of ONE subject (its folder), in one `describe` titled with the aspect; a module test `__tests__/<file>.test.ts(x)` holds one `describe` titled with the export it covers. `typescript fix` splits, moves and retitles ([Conventions § One file, one subject](../../docs/concepts/conventions.md#one-file-one-subject)).

## The shape every spec has

```typescript
// specs/api/api.specification.ts: the runner, once per suite, at the specification root
import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';
import { postgres } from '@jterrazz/test/services';

export const { api, cleanup } = await specification.api({
    server: () => ({ request: () => new Response('ok') }),
    services: { db: postgres() },
});

afterAll(cleanup);
```

```typescript
// specs/api/users/create/shape.spec.ts: POST /users
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('shape', () => {
    test('creates a user', async () => {
        // Given - an empty users table
        const result = await api.request(file('./__requests__/create-user.http'));

        // Then - the response and the row it wrote
        expect(result.response).toMatch(file('./__expected__/user-created.http'));
        await expect(result.table('users')).toMatch([[1, 'Alice']]);
    });
});
```

- One chain: zero or more setups, exactly ONE action; every assertion through `expect()`.
- The runner is destructured under its canonical name, with `afterAll(cleanup)`.
- Every test carries a `// Given -` line, then a `// Then -` line.

## What goes wrong most

- **A bare string where a file is meant.** `.seed('users.sql')` does not compile. Name the disk with `file('./__seeds__/users.sql')` or `directory(...)`, relative to the spec, in the test that reads it.
- **A probe where the whole result belongs.** Compare a response, a json, a table or an output WHOLE, written in place (``toMatch(`HTTP/1.1 200 OK ...`)``) or in `__expected__/` when several tests share it; add one precise assertion only if one property is the subject ([Assertions](../../docs/reference/assertions.md)).
- **A value that moves.** A `{{token}}`, never a literal; `TEST_UPDATE=1` writes the expected value, then read the diff ([Tokens](../../docs/reference/tokens.md)).
- **A double before the real thing.** The real thing, then a declared service, then a stub (`.intercept()`), then `mockOf<T>()`: the first rung that fits ([Time and doubles](../../docs/reference/time-and-doubles.md#the-doubles-ladder)). A call that must not happen is `http.never(...)` ([Stubs](../../docs/reference/stubs.md)).
- **Time.** `clock` only: `.clock('<iso>')` on a chain, `using _ = clock.at('<iso>')` in scope; never `vi.useFakeTimers` ([Time and doubles](../../docs/reference/time-and-doubles.md#the-clock)).
- **A folder that is no subject, spelt otherwise than `__<word>__/`.** `__setup__/`, `__seeds__/`, `__requests__/`, `__expected__/`, `__fixtures__/` are the closed list under `specs/`, and `__tests__/` the one in a code root; what several leaves share sits in the lowest folder they share (the specs root's for several specifications) ([Conventions § The naming recap](../../docs/concepts/conventions.md#the-naming-recap)).
- **A partial element name.** Names are exact: `link('Articles')` does not reach "Read Articles"; scope with `within(...)` ([The visitor](../../docs/reference/visitor.md)).
- **An `expect` in a scenario, a helper or a loop.** A scenario is the When; a helper returns what it reads; a loop asserts nothing over an empty collection.
- **Awaiting a sync matcher, or not awaiting an IO one.** A table, a directory and a page-captured subject are awaited; the types say which.
- **A setting every chain of a file repeats.** State it once, on a view: `const morning = api.with({ clock, headers })` ([Conventions § What a file shares](../../docs/concepts/conventions.md#what-a-file-shares)).

## Read next

| The test you are writing, or the question       | Chapter                                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| install, the vitest config, the `test()` preset | [docs/start/set-up-a-project.md](../../docs/start/set-up-a-project.md)                                                           |
| module                                          | [docs/guides/module-tests.md](../../docs/guides/module-tests.md)                                                                 |
| integration                                     | [docs/guides/integration-specs.md](../../docs/guides/integration-specs.md)                                                       |
| component                                       | [docs/guides/component-specs.md](../../docs/guides/component-specs.md)                                                           |
| website                                         | [docs/guides/website-specs.md](../../docs/guides/website-specs.md)                                                               |
| mobile                                          | [docs/guides/mobile-specs.md](../../docs/guides/mobile-specs.md)                                                                 |
| api                                             | [docs/guides/api-specs.md](../../docs/guides/api-specs.md)                                                                       |
| job                                             | [docs/guides/job-specs.md](../../docs/guides/job-specs.md)                                                                       |
| cli, and a `<case>.spec.yaml`                   | [docs/guides/cli-specs.md](../../docs/guides/cli-specs.md), [docs/guides/spec-documents.md](../../docs/guides/spec-documents.md) |
| lint: a rule over a tree, or alone              | [docs/guides/lint-specs.md](../../docs/guides/lint-specs.md)                                                                     |
| what the network replies                        | [docs/reference/stubs.md](../../docs/reference/stubs.md)                                                                         |
| a database, a cache, a process                  | [docs/reference/services.md](../../docs/reference/services.md)                                                                   |
| the clock, a port double                        | [docs/reference/time-and-doubles.md](../../docs/reference/time-and-doubles.md)                                                   |
| naming an element on any surface that draws     | [docs/reference/visitor.md](../../docs/reference/visitor.md)                                                                     |
| a matcher, sync or awaited                      | [docs/reference/assertions.md](../../docs/reference/assertions.md)                                                               |
| a `{{token}}`, or update mode                   | [docs/reference/tokens.md](../../docs/reference/tokens.md)                                                                       |
| why a convention holds, what review judges      | [docs/concepts/conventions.md](../../docs/concepts/conventions.md)                                                               |
| a rule id, a finding, the ratchet               | [docs/reference/linting.md](../../docs/reference/linting.md)                                                                     |
| anything else: the API is the types             | [docs/README.md](../../docs/README.md), the manual's map                                                                         |
