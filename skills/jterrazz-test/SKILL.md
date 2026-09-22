---
name: jterrazz-test
description: Testing conventions for @jterrazz projects — the eight kinds (module, integration, component, website, mobile, api, jobs, cli), vitest, real services, golden files, doubles. Use when writing, organizing, or debugging ANY test in a jterrazz repo, a plain module test included.
metadata:
    version: '17'
---

# `@jterrazz/test`

What to decide BEFORE writing a test. Everything else — every option, every matcher, every rule — is in the chapter this page sends you to, and the types say the API.

## Which kind — ask the fork first

Ask in order; the first yes is the kind, and the kind fixes the file, the constructor and the project ([docs/18-conventions.md](../../docs/18-conventions.md) carries the table).

1. A whole served page in a browser? → **website**, `specs/website/<domain>/<aspect>.spec.ts`
2. A component (React, a DOM function, a hook)? → **component**, `<file>.test.tsx` beside `<file>.tsx`
3. A screen on a simulator? → **mobile**, `specs/mobile/<domain>/<aspect>.spec.ts`
4. Answers HTTP? → **api**, `specs/api/<domain>/<aspect>.spec.ts`
5. Triggered by name, in-process? → **jobs**, `specs/jobs/<domain>/<aspect>.spec.ts`
6. A binary? → **cli**, `specs/cli/<domain>/<case>.spec.yaml` (or `<aspect>.spec.ts`)
7. A module needing a real service, or whose oracle is a golden? → **integration**, `specs/integration/<domain>/<aspect>.spec.ts`
8. A module alone? → **module**, `<file>.test.ts` beside `<file>.ts`
9. The repository itself, a suite over several apps? → **repository suite**, `specs/<family>/<aspect>.test.ts`

The suffix IS the kind: `.test.ts(x)` beside the code, `.spec.ts` under `specs/<facet>/`, `<case>.spec.yaml` for a document, `<facet>.specification.ts` for the file that builds a runner.

## The shape every spec has

```typescript
import { afterAll } from 'vitest';
import { postgres, specification } from '@jterrazz/test';

export const { api, cleanup } = await specification.api({
    server: () => ({ request: () => new Response('ok') }),
    services: { db: postgres() },
});

afterAll(cleanup);
```

```typescript
// specs/api/users/creation.spec.ts
test('creates a user', async () => {
    // Given - one existing user
    const result = await api
        .seed(file('./seeds/one-user.sql'))
        .request(file('./requests/create-user.http'));

    // Then - the response and the row it wrote
    expect(result.response).toMatch(file('./expected/user-created.http'));
    await expect(result.table('users')).toMatchRows({ columns: ['name'], rows: [['Alice']] });
});
```

- One chain, zero or more setups, exactly ONE terminal action; every assertion through `expect()`.
- A runner lives in a `*.specification.ts` at the facet root, destructured under its canonical name, with `afterAll(cleanup)`.
- Every test carries a `// Given -` line, then a `// Then -` line.

## A string is a value; the disk is `file()` or `directory()`

What a test stands on is named by one of two calls, with the path relative to the spec file spelled in full; the verbs keep simple names and the type refuses a bare string where a file is meant:

| Call                                                                     | Reads                                       |
| ------------------------------------------------------------------------ | ------------------------------------------- |
| `.seed(file('./seeds/users.sql'))`                                       | database state, before the action           |
| `.request(file('./requests/create.http'))`                               | a complete request — the terminal action    |
| `.post('/orders', file('./requests/order.json'))`                        | a request body, sent as the file holds it   |
| `.fixture(file('./fixtures/config.toml'))`                               | one file, copied into the working directory |
| `.fixture(directory('../../fixtures/shop/'))`                            | a directory's contents, spread into it      |
| `cli.run(file('./build.spec.yaml'))`                                     | a document, run from a test                 |
| `expect(x).toMatch(file('./expected/out.txt'))`                          | a golden file, `{{token}}`s resolved        |
| `await expect(result.filesystem).toMatch(directory('./expected/tree/'))` | a golden tree                               |

`toMatch` with a string or a RegExp, and `toContain`, are vitest's own: a stream is compared through its text — ANSI stripped, the runner's `transform` applied — `expect(result.stdout.text).toMatch(/built/)`; `.raw` is the capture as it was. Ground sits in four reserved folders — `fixtures/`, `expected/`, `requests/`, `seeds/` — each verb reads its own, and the shared pool is `specs/fixtures/`, reached by the path that climbs to it. `TEST_UPDATE=1` writes a golden; read the diff, then run again without it.

## Pitfalls

- **A bare string where a file is meant** — `.seed('users.sql')` and `file('users.sql')` do not compile, and a document's `fixture: shop/` is refused on its line. Write `file('./seeds/users.sql')`.
- **A domain named `fixtures`, `expected`, `requests` or `seeds`** — the names are reserved for ground; C1 refuses a spec under one.
- **Reaching into a sibling leaf** — a path may leave its leaf only into `specs/fixtures/` (C15). Shared ground goes to the pool.
- **`expect(result.stdout).toContain('built')`** — a stream is not a string, and it does not compile: a value matcher reads the stream's `.text`, the text a golden compares. A golden is `.toMatch(file('./expected/help.txt'))`.
- **A partial element name** — names are exact: `link('Articles')` does not reach "Read Articles". Write the name whole, or scope it with `within(…)`.
- **Awaiting a sync matcher, or not awaiting an IO one** — `toMatchRows`, `toMatch(directory(…))`, `toBeEmpty` are awaited; `toMatch(file(…))` is not, except on a subject captured inside a page (D2).
- **A double before the real thing** — the ladder is: the real thing → a declared service → a contract (`.intercept()`) → a typed port double (`mockOf<T>()`). Take the first rung that fits.
- **Time** — `clock` only (`.clock('<iso>')` on a chain, `using _ = clock.at('<iso>')` in scope); never `vi.useFakeTimers`.
- **A 16.x tree** — `npx jterrazz-test-check --fix` renames the ground folders and rewrites every literal call and document, module tests included.

## Read next

| The test you are writing                    | Chapter                                                  |
| ------------------------------------------- | -------------------------------------------------------- |
| module                                      | [docs/05-module-tests.md](../../docs/05-module-tests.md) |
| integration                                 | [docs/06-integration.md](../../docs/06-integration.md)   |
| component                                   | [docs/07-component.md](../../docs/07-component.md)       |
| website                                     | [docs/08-website.md](../../docs/08-website.md)           |
| mobile                                      | [docs/09-mobile.md](../../docs/09-mobile.md)             |
| api                                         | [docs/10-api.md](../../docs/10-api.md)                   |
| jobs                                        | [docs/11-jobs.md](../../docs/11-jobs.md)                 |
| cli, or a `<case>.spec.yaml`                | [docs/12-cli.md](../../docs/12-cli.md)                   |
| naming an element on any surface that draws | [docs/13-elements.md](../../docs/13-elements.md)         |
| a matcher, sync or awaited                  | [docs/14-assertions.md](../../docs/14-assertions.md)     |
| a `{{token}}`, or update mode               | [docs/15-tokens.md](../../docs/15-tokens.md)             |
| what the network replies                    | [docs/16-contracts.md](../../docs/16-contracts.md)       |
| a database, a cache, a process              | [docs/17-services.md](../../docs/17-services.md)         |
| a rule id a diagnostic printed              | [docs/19-linting.md](../../docs/19-linting.md)           |

The manual's map is [docs/README.md](../../docs/README.md); the API is the types the package publishes.
