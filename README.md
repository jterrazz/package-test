# @jterrazz/test

Declarative testing framework for APIs, jobs, CLIs, modules against real services, websites, mobile apps and rendered components. Six constructors — `specification.api()`, `specification.jobs()`, `specification.cli()`, `specification.integration()`, `specification.website()`, `specification.mobile()` — plus the `component` chain, which starts nothing and needs none. Specs read as sentences: given → action → assertions. The vitest test name is the spec's description; all assertions go through `expect()` with auto-registered, subject-typed matchers.

```bash
npm install -D @jterrazz/test vitest
```

Everything a spec needs imports from `@jterrazz/test`. The exceptions are the two TOOL subpaths, which no spec ever imports: `@jterrazz/test/oxlint` (the zero-runtime lint plugin and its config fragment, loading no test runtime) and `@jterrazz/test/vitest` (what `vitest.config.ts` imports — the `defineSpecConfig()` preset and the `literate()` plugin).

## Quick start

### API testing (HTTP)

```typescript
// specs/api/api.specification.ts
import { afterAll } from 'vitest';
import { postgres, specification } from '@jterrazz/test';
import { createApp } from '../../src/app.js';

export const { api, cleanup } = await specification.api({
    services: { db: postgres() }, // → reported as "db"; init from docker/db/
    server: ({ db }) => createApp({ databaseUrl: db.connectionString }),
});

afterAll(cleanup);
```

```typescript
// specs/api/users/users.spec.ts
import { expect, test } from 'vitest';
import { api } from '../api.specification.js';

test('creates a user', async () => {
    // Given - the complete request from _requests/create-user.http
    const result = await api.request('create-user.http');

    // Then - status + headers + body from _expected/user-created.http; row in db
    expect(result.response).toMatch('user-created.http');
    await expect(result.table('users')).toMatchRows({
        columns: ['name'],
        rows: [['Alice']],
    });
});
```

### CLI testing

```typescript
// specs/cli/cli.specification.ts
import { resolve } from 'node:path';
import { afterAll } from 'vitest';
import { specification } from '@jterrazz/test';

export const { cli, cleanup } = await specification.cli(
    resolve(import.meta.dirname, '../../bin/my-cli.sh'),
);

afterAll(cleanup);
```

```typescript
// specs/cli/build/build.spec.ts
import { expect, test } from 'vitest';
import { cli } from '../cli.specification.js';

test('builds the project', async () => {
    // Given - sample app project spread into the cwd
    const result = await cli.fixture('$FIXTURES/sample-app/').exec('build');

    // Then - ESM output, no CJS
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Build completed');
    expect(result.file('dist/index.js').exists).toBe(true);
    expect(result.file('dist/index.cjs').exists).toBe(false);
});
```

A CLI session can also BE the spec file. A `<case>.spec.yaml` document states one scenario — its ground, then its runs — and executes either as a test file of its own (the `literate()` vite plugin) or through `cli.run('case.spec.yaml')`:

```yaml
description: refuses to build without a manifest
runs:
    - command: build
      exit: 1
      stderr: |
          Error: no my-cli.yaml in the current directory
```

Same engine as the chain, same `{{token}}` grammar, same `TEST_UPDATE=1` — which rewrites each run's exit code and streams, and nothing else. A JSON Schema ships at `@jterrazz/test/schema` so an editor validates as you type. Full grammar: [docs/07-cli.md](docs/07-cli.md#spec-documents--casespecyaml).

### Website testing (browser)

```typescript
// specs/website/website.specification.ts
import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, website } = await specification.website({
    server: { command: 'node specs/_fixtures/website-app/server.mjs', ready: '/' },
});

afterAll(cleanup);
```

```typescript
// specs/website/visit/head.spec.ts
import { expect, test } from 'vitest';
import { website } from '../website.specification.js';

test('captures the full head surface of a rendered page', async () => {
    // Given - the fixture homepage
    const result = await website.visit('/');

    // Then - one golden covers title, canonical, alternates, and metas
    expect(result.status).toBe(200);
    expect(result.head).toMatch('home.head.json');
});
```

### Mobile testing (iOS simulator)

```typescript
// specs/mobile/mobile.specification.ts
import { specification } from '@jterrazz/test';
import { afterAll } from 'vitest';

export const { cleanup, mobile } = await specification.mobile({
    app: { bundleId: 'com.jterrazz.fakenews' },
    device: { name: 'iPhone 17', os: '26.5' },
});

afterAll(cleanup);
```

```typescript
// specs/mobile/events/feed.spec.ts
import { expect, test } from 'vitest';
import { mobile } from '../mobile.specification.js';

test('shows the events feed behind its deep link', async () => {
    // Given - the events screen
    const result = await mobile.open('news://events');

    // Then - one golden covers the whole projected accessibility tree
    expect(result.screen).toMatch('events.screen.json');
});
```

Actions are **terminal**: `.request()`, `.get()`, `.trigger()`, `.exec()`, `.call()`, `.fetch()`, `.visit()`, `.open()` execute the spec and resolve to a precisely typed result. There is no `.run()`, no label, and no `.spawn()`.

## The whole surface, one chapter per subject

Everything below the quick start is stated ONCE, in the chapter that owns it — a second copy here would be a second answer, and the one a reader meets first is the one that goes stale.

| Subject                                                            | Chapter                                                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| The six constructors, their options, the handles they return       | [docs/05](docs/05-api.md)–[docs/07](docs/07-cli.md), [docs/14](docs/14-website.md)–[docs/17](docs/17-integration.md) |
| A rendered component — no constructor, the chain and `component()` | [docs/16](docs/16-component.md)                                                                                      |
| The chain: setups, terminal actions, what each result carries      | [docs/08](docs/08-assertions.md)                                                                                     |
| Every matcher, by subject                                          | [docs/08](docs/08-assertions.md)                                                                                     |
| The `{{token}}` grammar, `#ref` captures, update mode              | [docs/09](docs/09-tokens.md)                                                                                         |
| Contracts, selection, the provider builders, `intercept()`         | [docs/10](docs/10-contracts.md)                                                                                      |
| Services, init scripts, per-worker isolation, `process()`          | [docs/11](docs/11-services.md)                                                                                       |
| `defineSpecConfig()`, the project helpers, the artefact paths      | [docs/02](docs/02-developing.md#vitest-config-the-preset)                                                            |
| The conventions, and the catalogue that enforces them              | [docs/12](docs/12-conventions.md), [docs/13](docs/13-linting.md)                                                     |

## Conventions

Normative rules live in the constitution ([docs/12-conventions.md](docs/12-conventions.md)); the generated per-rule catalogue is [docs/13-linting.md](docs/13-linting.md). A facet (`specs/<facet>/`) carries its runner(s) at its root and holds domain folders; the folder follows the assets:

```
specs/<facet>/                  # api | jobs | cli | integration | website | mobile
├── <facet>.specification.ts    # runner(s) at the facet ROOT (rule C1)
└── <domain>/                   # a product command/area — 1..n specs
    ├── <aspect>.spec.ts
    ├── _seeds/          # *.sql ONLY — database state
    ├── _requests/       # *.http — inputs: COMPLETE request (method, path, headers, body)
    ├── contracts/      # <name>.contracts.ts facade + <provider>/<name>.ts units + their .response.json / .request.ts data
    ├── _fixtures/       # domain-local files/dirs copied into the cwd (cli) — shared pool lives at specs/_fixtures/
    └── _expected/       # ALL expected fixtures, FLAT (incl. response *.http) — a slash in the name creates a subfolder
```

**The suffix says the kind.** A UNIT sits beside its code: `<file>.test.ts` for a module, `<file>.test.tsx` for a component. The assembled product, met through an entry, sits under `specs/<facet>/` as `<aspect>.spec.ts`. A spec with its OWN asset dirs gets its own domain folder; specs without local assets group as siblings inside a named group folder (the folder follows the assets). `.fixture(path)` is the one verb that copies into the cwd: domain-local (`_fixtures/…`) or shared (`$FIXTURES/…` → `specs/_fixtures/…`), with rsync trailing-slash semantics and layering. `.seed()` is SQL-only.

Every test contains `// Given -` and `// Then -` comments (always both; `// When -` only if the action is not obvious — the chain IS the when). User-facing framework env var: `TEST_UPDATE` — the only one you set; the framework also reads vitest's `VITEST_POOL_ID` for per-worker isolation.

### Convention enforcement — the shipped lint plugin

These conventions are not just prose: the package ships an oxlint plugin (`@jterrazz/test/oxlint`), plus a `jterrazz-test-check` binary (the conventions checker) that reads the data fixtures and cross-file relationships oxlint cannot. Wire the plugin into your `oxlint.config.ts` and run `jterrazz-test-check specs` in CI — the full seven-channel catalogue (each rule, its channel and rationale) is generated into [docs/13-linting.md](docs/13-linting.md).

## Requirements

- **Docker** - testcontainers for the container-backed services; not needed for `sqlite()`, plain cli specs, website specs, or mobile specs
- **Node 24+** and **vitest 5** - the two required peers
- **better-sqlite3 / pg / redis / testcontainers** - optional peer dependencies, one per service a repository declares: `postgres()` needs `pg` + `testcontainers`, `redis()` needs `redis` + `testcontainers`, `sqlite()` needs `better-sqlite3`. Each is loaded the first time its service starts, and the message names the peer and the command. Under pnpm a native binding also needs its package listed in `onlyBuiltDependencies`, which the message says too
- **playwright** - optional peer dependency, only needed for `.visit()`: `npm install -D playwright && npx playwright install chromium`
- **appium + webdriverio** - optional peer dependencies, only needed for `specification.mobile()`: `npm install -D appium webdriverio && npx appium driver install xcuitest` — plus Xcode, a simulator, and the app installed on it
- **msw**, **vitest-mock-extended**, **yaml** - the three direct dependencies, bundled; no separate install, and declaring one yourself is rule F8's finding
- **hono** (or any web framework) - supplied by your project for in-process apps; the adapter only needs an object with a `request()` method, so it is not a peer

## Docs

- Guide (chapters): [docs/README.md](docs/README.md) — getting started, API/jobs/CLI/website/mobile specs, assertions, tokens, contracts, services, conventions, linting
- API reference: committed under [docs/reference/](docs/reference/) — compiled from source by `npm run docs`
- Agent skill: [skills/jterrazz-test/](skills/jterrazz-test/) — mental model, per-facet references, generated rule reference
