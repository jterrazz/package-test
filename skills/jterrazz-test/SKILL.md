---
name: jterrazz-test
description: Testing conventions for @jterrazz projects — the nine kinds (module, integration, component, website, mobile, api, job, cli, lint) plus the repository suite, vitest, real services, golden files, doubles. Use when writing, organizing, or debugging ANY test in a jterrazz repo, a plain module test included.
metadata:
    version: '17'
---

# `@jterrazz/test`

What to decide BEFORE writing a test. Everything else — every option, every matcher, every rule — is in the chapter this page sends you to, and the types say the API.

## Which kind — ask the fork first

Ask in order; the first yes is the kind, and the kind fixes the file, the constructor and the project ([docs/18 § The fork](../../docs/18-conventions.md#the-fork--which-kind-of-test-this-is) carries the table, and a meta-test holds this list to it).

1. A whole served page in a browser? → **website**, `specs/website/<domain>/<aspect>.spec.ts`
2. A component (React, a DOM function, a hook)? → **component**, `<file>.test.tsx` beside `<file>.tsx`
3. A screen on a simulator? → **mobile**, `specs/mobile/<domain>/<aspect>.spec.ts`
4. Answers HTTP? → **api**, `specs/api/<resource>/<action>/<aspect>.spec.ts` — the folder derived from the route (`GET /events` → `events/list/`)
5. Triggered by name, in-process? → **job**, `specs/job/<job>/<aspect>.spec.ts`
6. A binary? → **cli**, `specs/cli/<command>/<case>.spec.yaml` (or `<aspect>.spec.ts`)
7. A rule the project ships — a plugin, a checker, a preset? → **lint**, `specs/lint/<rule>/<aspect>.spec.ts`; the rule's visitor alone is a module test on `ruleTester()`, each error at its `line` and `column`
8. A module needing a real service, or whose oracle is a golden? → **integration**, `specs/integration/<domain>/<aspect>.spec.ts`
9. A module alone? → **module**, `<file>.test.ts` beside `<file>.ts`
10. The repository itself, a suite over several apps? → **repository suite**, `specs/<suite>/<domain>/<aspect>.test.ts`

The suffix IS the kind: `.test.ts(x)` beside the code, `.spec.ts` under `specs/<facet>/`, `<case>.spec.yaml` for a document, `<facet>.specification.ts` for the file that builds a runner. A spec file asks ONE question (its name, the aspect — never `misc`) of ONE subject (its folder), in one `describe` titled with the aspect, under 400 lines, each test's body under 60. A colocated `.test.ts(x)` holds one `describe` too, titled with its subject — the export of the module beside it (`describe('LocaleNote', …)`). `make fix` splits, moves and retitles ([docs/18](../../docs/18-conventions.md#one-file-one-subject)).

## The shape every spec has

```typescript
// specs/api/api.specification.ts
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

- One chain, zero or more setups, exactly ONE terminal action; every assertion through `expect()`.
- A runner lives in a `*.specification.ts` at the facet root, destructured under its canonical name, with `afterAll(cleanup)`.
- Every test carries a `// Given -` line, then a `// Then -` line.

## A string is a value; the disk is `file()` or `directory()`

What a test stands on is named by one of two calls, with the path relative to the spec file spelled in full; the verbs keep simple names and the type refuses a bare string where a file is meant:

| Call                                                                      | Reads                                                                                    |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `.seed(file('./_seeds/users.sql'))`                                       | database state, before the action — never SQL inline                                     |
| `.request(file('./_requests/create.http'))`                               | a complete request — the terminal action                                                 |
| `.post('/orders', file('./_requests/order.json'))`                        | a request body, sent as the file holds it                                                |
| `.fixture(file('./_fixtures/config.toml'))`                               | one file copied into the working directory, or a `directory()`'s contents spread into it |
| `.link('@acme/sdk', directory('./_fixtures/sdk/'))`                       | a package, linked into the cwd's `node_modules`                                          |
| `cli.run(file('./build.spec.yaml'))`                                      | a cli document, run from a test                                                          |
| `expect(x).toMatch(file('./_expected/out.txt'))`                          | a golden file, `{{token}}`s resolved                                                     |
| `await expect(result.filesystem).toMatch(directory('./_expected/tree/'))` | a golden tree                                                                            |

`toMatch` on a result — a response, a stream, a json, a table — compares the WHOLE result: to the value written in place (``toMatch(`HTTP/1.1 200 OK …`)``, `toMatch([[1, 'Alice']])`, tokens allowed), or to `file()`/`directory()`. On a plain string it is vitest's own, and a `file()` there is refused — wrap the string to golden it, `expect(text(message)).toMatch(file(…))`: a stream's text is its `.text` — ANSI stripped, the runner's `transform` applied — `expect(result.stdout.text).toMatch(/built/)`; `.raw` is the capture as it was. Ground sits in four reserved folders — `_fixtures/`, `_expected/`, `_requests/`, `_seeds/` — each verb reads its own, and the same four under the specs root's one `_shared/` folder (`specs/_shared/_fixtures/`, `specs/_shared/_seeds/`, …) hold what several leaves share, reached by the path that climbs to them. `TEST_UPDATE=1` writes a golden; read the diff, then run again without it.

## Pitfalls

- **A bare string where a file is meant** — `.seed('users.sql')` and `file('users.sql')` do not compile, and a document's `fixture: shop/` is refused on its line. Write `file('./_seeds/users.sql')`.
- **A filled path where the route has parameters** — `.get('/indicators/btc/chart')` hides that `btc` is a value. Write the route as the app declares it, the values beside it: `.get('/indicators/:symbol/chart', { params: { symbol: 'btc' } })` — the template types the params, files the spec and is what route coverage reads.
- **A probe where the whole result belongs** — a test reading a response, a json or a table compares it WHOLE, its value written in place (``toMatch(`HTTP/1.1 200 OK …`)``), then adds a precise assertion only if one property is the subject.
- **A folder that is no subject, spelled without its `_`** — `fixtures/`, `seeds/`, `setup/`, `doubles/`: the folders under `specs/` that are no subject form a closed list, `_setup/` (code that prepares specs), `_seeds/`, `_requests/`, `_expected/`, `_fixtures/` (ground) and `_shared/` at the root (`reserved-folder-in-closed-list`). Helpers, test adapters (`<port>.adapter.ts`) and stubs go in a `_setup/`, never beside the specs nor in a `*.fixtures.ts` (`spec-code-in-setup-folder`).
- **Reaching into a sibling leaf** — a path may leave its leaf only by climbing, into the ground of a folder that encloses it or `specs/_shared/<role>/` (`no-reach-into-sibling-ground`). What several leaves share — data or `_setup/` code — sits in the reserved folder of the lowest folder they share (`ground-shared-or-inline`, `setup-module-at-lowest-common-folder`).
- **`expect(result.stdout).toContain('built')`** — a stream is not a string, and it does not compile: a value matcher reads the stream's `.text`, the text a golden compares. A golden is `.toMatch(file('./_expected/help.txt'))`. A part of a result is no comparison of it either: `expect(result.response).toMatch(/200/)` does not compile — a response takes its whole `.http` text or its `file()`, a json its value, a table its rows, a tree its `directory()`.
- **An `expect` in a helper or a loop** — a `_setup/` module, a test adapter or a `*.specification.ts` returns what it reads, and the test asserts it (`no-expect-outside-a-test`); a loop asserts nothing over an empty collection, so compare the collection whole or state the cases with `test.each` (`no-expect-in-a-loop`).
- **A partial element name** — names are exact: `link('Articles')` does not reach "Read Articles". Write the name whole, or scope it with `within(…)`.
- **Awaiting a sync matcher, or not awaiting an IO one** — a table's `toMatch(<rows>)`, `toMatch(directory(…))`, `toBeEmpty` are awaited; `toMatch(file(…))` is not, except on a subject captured inside a page (the types say which: `typescript/no-floating-promises`, `typescript/await-thenable`).
- **A double before the real thing** — the ladder is: the real thing → a declared service → a stub (`.intercept()`) → a typed port double (`mockOf<T>()`). Take the first rung that fits. A call that must not happen is `.intercept(http.never(http.post(url)))` — `http.unreachable()` and an empty error say it failed, not that it never happened.
- **Time** — `clock` only (`.clock('<iso>')` on a chain, `using _ = clock.at('<iso>')` in scope); never `vi.useFakeTimers`.
- **A setting every chain of a file repeats** — state it once, on a view: `const events = api.with({ clock: '<iso>', headers })`; a seed or a stub stays on its test's chain.

## Read next

| The test you are writing                    | Chapter                                                  |
| ------------------------------------------- | -------------------------------------------------------- |
| module                                      | [docs/05-module-tests.md](../../docs/05-module-tests.md) |
| integration                                 | [docs/06-integration.md](../../docs/06-integration.md)   |
| component                                   | [docs/07-component.md](../../docs/07-component.md)       |
| website                                     | [docs/08-website.md](../../docs/08-website.md)           |
| mobile                                      | [docs/09-mobile.md](../../docs/09-mobile.md)             |
| api                                         | [docs/10-api.md](../../docs/10-api.md)                   |
| job                                         | [docs/11-job.md](../../docs/11-job.md)                   |
| cli                                         | [docs/12-cli.md](../../docs/12-cli.md)                   |
| a cli `<case>.spec.yaml`                    | [docs/20-documents.md](../../docs/20-documents.md)       |
| lint — a rule over a tree, or alone         | [docs/21-lint.md](../../docs/21-lint.md)                 |
| naming an element on any surface that draws | [docs/13-elements.md](../../docs/13-elements.md)         |
| a matcher, sync or awaited                  | [docs/14-assertions.md](../../docs/14-assertions.md)     |
| a `{{token}}`, or update mode               | [docs/15-tokens.md](../../docs/15-tokens.md)             |
| what the network replies                    | [docs/16-stubs.md](../../docs/16-stubs.md)               |
| a database, a cache, a process              | [docs/17-services.md](../../docs/17-services.md)         |
| a rule id, or wiring the `test()` preset    | [docs/19-linting.md](../../docs/19-linting.md)           |
| anything else — the API is the types        | [docs/README.md](../../docs/README.md), the manual's map |
