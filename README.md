# @jterrazz/test

A testing framework on vitest for whole products: HTTP APIs, background jobs, CLIs, websites, native mobile apps, rendered components, modules against real databases, and the lint rules a project ships. You declare what a test needs — Postgres, a built binary, a real Chromium, an iOS simulator — and the framework starts it, isolates it per worker and cleans it up. Each test is one sentence: a few setups, one action, and the whole result compared with `expect()`.

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

`api` comes from a specification file that builds it once for the suite: `specification.api({ services: { db: sqlite() }, server: … })` starts the database, wires your app to it and serves it in the test process. [Getting started](docs/start/getting-started.md) walks through it from `npm install` to a green run.

## Why

- **The infrastructure is declared, not scripted.** `postgres()`, `redis()`, `sqlite()` and `process()` are started for you, one database per worker, reset before every test.
- **A result is compared whole.** The full response, table, output or page outline, written in the test or in a file beside it, with `{{tokens}}` for values that move. `TEST_UPDATE=1` writes the expected values for you to review.
- **The conventions are a linter.** Where a test lives, how it is named and what it may import are checked by an oxlint plugin and a checker, and every finding says what it found, why, how to fix this case, and where to read more.

## Install

```bash
npm install -D @jterrazz/test @jterrazz/typescript vitest
```

[`@jterrazz/typescript`](https://github.com/jterrazz/package-typescript) is the toolchain the framework is built for: one devDependency that builds, type-checks, lints and formats a project, run as `npx typescript check` and `npx typescript fix` (its bin is named `typescript`; it is not Microsoft's compiler package). It is a required peer ([why](docs/start/set-up-a-project.md#what-to-install)), and its lint conventions are opt-in: a project that never lists the framework's preset in `jterrazz.config.ts` runs none of them, and writes its tests all the same.

An ES module project on Node 24, vitest 5 and `@jterrazz/typescript` 11 is required ([Setting up § Project requirements](docs/start/set-up-a-project.md#project-requirements)). A browser, a database driver or a simulator is installed only by a project that tests through it, and the error names the package when one is missing — [Setting up a project](docs/start/set-up-a-project.md#what-to-install).

## What you can test

| Kind                                            | Subject                                                         | Entry point                    |
| ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| [Module](docs/guides/module-tests.md)           | One module, beside its code, nothing started                    | plain vitest, `<file>.test.ts` |
| [Integration](docs/guides/integration-specs.md) | A module against real services, or against a golden             | `specification.integration()`  |
| [Component](docs/guides/component-specs.md)     | A React component, hook or DOM function in a real Chromium      | `component.render()`           |
| [Website](docs/guides/website-specs.md)         | A served page, fetched or driven in a browser                   | `specification.website()`      |
| [Mobile](docs/guides/mobile-specs.md)           | A native app on an iOS simulator                                | `specification.mobile()`       |
| [API](docs/guides/api-specs.md)                 | An HTTP app, through complete requests                          | `specification.api()`          |
| [Job](docs/guides/job-specs.md)                 | A pipeline triggered by name                                    | `specification.job()`          |
| [CLI](docs/guides/cli-specs.md)                 | A binary in a fresh working directory, often as a YAML document | `specification.cli()`          |
| [Lint](docs/guides/lint-specs.md)               | The rules a project ships, over fixture trees                   | `specification.lint()`         |

Which kind a test is depends on its subject, and one ordered list of questions decides it: [Which kind of test](docs/start/getting-started.md#which-kind-of-test).

## Documentation

The manual is [`docs/`](docs/README.md), mapped by the same four families as the package's exports:

- **What is tested** — one guide per kind, linked above.
- **What surrounds the subject** — [stubs](docs/reference/stubs.md) for the network, [services](docs/reference/services.md) for databases and processes, [time and doubles](docs/reference/time-and-doubles.md).
- **Acting on a screen** — [the visitor](docs/reference/visitor.md): `click`, `fill`, `see`, and how elements are named.
- **Judging the result** — [assertions](docs/reference/assertions.md) and [tokens](docs/reference/tokens.md).

The conventions and their reasons are [Conventions](docs/concepts/conventions.md); every rule, generated from the code, is [Linting](docs/reference/linting.md). The API is the types the package publishes — your editor reads them. Agents read [`skills/jterrazz-test/SKILL.md`](skills/jterrazz-test/SKILL.md).
