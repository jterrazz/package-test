# @jterrazz/test

Declarative testing framework for modules, APIs, jobs, CLIs, rendered components, websites and native apps. Seven constructors — `specification.api()`, `specification.jobs()`, `specification.cli()`, `specification.integration()`, `specification.website()`, `specification.mobile()` — plus the `component` chain, which starts nothing and needs none.

A spec reads as a sentence: given → action → assertions. The vitest test name is its only description, every assertion goes through `expect()` with subject-typed matchers, and the infrastructure a spec declares — Postgres, Redis, SQLite, a child process, a real Chromium, an iOS simulator — is started, isolated per worker and cleaned up for you.

```bash
npm install -D @jterrazz/test vitest
```

Everything a spec needs imports from `@jterrazz/test`. The other three entries are tools no spec imports: `@jterrazz/test/vitest` (what `vitest.config.ts` imports), `@jterrazz/test/oxlint` (the zero-runtime lint plugin) and `@jterrazz/test/schema` (the document JSON Schema).

## One kind of test, one example

Which kind a test is, is the first question — [the fork](docs/18-conventions.md#the-fork--which-kind-of-test-this-is) asks it in nine lines and the answer fixes the folder, the constructor and the project.

**A module** — beside its code, nothing started ([docs/05](docs/05-module-tests.md)):

```typescript
// src/domain/ranking.test.ts
import { clock } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { rank } from './ranking.js';

test('ranks a fresher post above an older one of equal score', () => {
    // Given - two posts of equal score, one written this morning
    using _ = clock.at('2026-03-04T09:30:00Z');

    // Then - the fresher one leads
    expect(rank(posts).map((post) => post.id)).toStrictEqual(['fresh', 'stale']);
});
```

**An integration spec** — a module against the real thing, or against a golden ([docs/06](docs/06-integration.md)):

```typescript
// specs/integration/posts/find.spec.ts
import { expect, test } from 'vitest';

import { integration } from '../integration.specification.js';

test('finds the post the migration wrote', async () => {
    // Given - a seeded database
    const result = await integration.seed('posts.sql').call(({ db }) => findPost(db, 'p-1'));

    // Then - the row comes back as the repository shapes it
    await expect(result.value).toMatch('found.json');
});
```

**A component** — a rendered unit in a real browser, beside its code ([docs/07](docs/07-component.md)):

```tsx
// src/presentation/post-table.test.tsx
import { component, content } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { PostTable } from './post-table.js';

test('says how much of the collection the table is showing', async () => {
    // Given - a page of one row answering for a collection of two hundred
    const result = await component.intercept(listing).render(<PostTable />, async (visitor) => {
        await visitor.see(content('Showing 1 of 200 posts'));
    });

    // Then - the table is qualified by what it is not showing
    await expect(result.tree).toMatch('one-of-two-hundred.aria.yaml');
});
```

**A website** — the served page, driven in a browser ([docs/08](docs/08-website.md)):

```typescript
// specs/website/subscribe/subscribe.spec.ts
import { button, field } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { website } from '../website.specification.js';

test('subscribes through the form and captures the final state', async () => {
    // Given - a visitor on the homepage
    const result = await website.visit('/', async (visitor) => {
        await visitor.fill(field('Email'), 'visitor@site.test');
        await visitor.click(button('Subscribe'));
    });

    // Then - the page says so, and the console is clean
    expect(result.content).toContain('Thanks for subscribing');
    await expect(result.errors).toBeEmpty();
});
```

**A mobile screen** — the installed app on a simulator ([docs/09](docs/09-mobile.md)):

```typescript
// specs/mobile/events/bookmark.spec.ts
import { button, content } from '@jterrazz/test';
import { expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

test('bookmarks an event from its detail screen', async () => {
    // Given - a visitor on the events feed
    const result = await mobile.open('news://events', async (visitor) => {
        await visitor.tap(button('Enquête Fauci COVID-19'));
        await visitor.see(content('rapports'));
        await visitor.tap(button('Bookmark'));
    });

    // Then - the capture reflects the screen after the interaction
    expect(result.content).toContain('Bookmarked');
});
```

**An API** — the assembled app, met through a complete HTTP exchange ([docs/10](docs/10-api.md)):

```typescript
// specs/api/users/create-user.spec.ts
import { expect, test } from 'vitest';

import { api } from '../api.specification.js';

test('creates a user and returns its location', async () => {
    // Given - an empty users table
    const result = await api.seed('empty.sql').request('create-user.http');

    // Then - the response matches the golden, tokens and all
    expect(result.response).toMatch('user-created.http');
    await expect(result.table('users')).toMatchRows([{ name: 'Alice' }]);
});
```

**A job** — what a name triggers, in-process ([docs/11](docs/11-jobs.md)):

```typescript
// specs/jobs/digest/daily-digest.spec.ts
import { expect, test } from 'vitest';

import { jobs } from '../jobs.specification.js';

test('writes one digest row per active subscriber', async () => {
    // Given - two active subscribers and one cancelled
    const result = await jobs.seed('subscribers.sql').trigger('daily-digest');

    // Then - only the active ones were written
    await expect(result.table('digests')).toMatchRows([
        { to: 'a@site.test' },
        { to: 'b@site.test' },
    ]);
});
```

**A CLI** — the built binary, usually as a document ([docs/12](docs/12-cli.md)):

```yaml
# specs/cli/scaffold/new-project.spec.yaml
description: scaffolds a project into an empty directory
fixture: empty-dir
runs:
    - command: new my-app
      exitCode: 0
      stdout: scaffolded.txt
      files:
          my-app/package.json: package.json
```

## The map

Everything is stated ONCE, in the chapter that owns it — a second copy here would be a second answer, and the one a reader meets first is the one that goes stale. The corpus map is [docs/README.md](docs/README.md).

| Subject                                                          | Chapter                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| What the framework is, its trees, its channels, its four entries | [docs/01](docs/01-architecture.md)                               |
| Installing it, the preset, the project helpers                   | [docs/02](docs/02-developing.md#vitest-config-the-preset)        |
| Each kind of test, one chapter, the same seven sections          | [docs/05](docs/05-module-tests.md)–[docs/12](docs/12-cli.md)     |
| Naming an element: descriptors, verbs, `within`, exact names     | [docs/13](docs/13-elements.md)                                   |
| Every matcher, by subject                                        | [docs/14](docs/14-assertions.md)                                 |
| The `{{token}}` grammar, `#ref` captures, update mode            | [docs/15](docs/15-tokens.md)                                     |
| Contracts, selection, provider builders, `intercept()`           | [docs/16](docs/16-contracts.md)                                  |
| Services, init scripts, per-worker isolation, `process()`        | [docs/17](docs/17-services.md)                                   |
| The conventions, and the catalogue that enforces them            | [docs/18](docs/18-conventions.md), [docs/19](docs/19-linting.md) |

The conventions are not prose alone: the package ships an oxlint plugin (`@jterrazz/test/oxlint`) and a `jterrazz-test-check` binary that reads the fixtures and cross-file relationships oxlint cannot. Every diagnostic ends in a rule id and an anchor into the generated catalogue.

## Requirements

- **Node 24+** and **vitest 5** — the two required peers.
- **Docker** — for `postgres()` and `redis()`; not needed for `sqlite()`, a CLI spec, a website spec or a component spec.
- **Optional peers, one per thing a repository declares** — `better-sqlite3`, `pg`, `redis`, `testcontainers` for the services; `playwright` for a page or a component, with `@vitest/browser-playwright` pinned to the runner's exact version; `appium` + `webdriverio` for a simulator. Each is loaded the first time it is needed and the refusal names the peer, the facet that asked and the install command — under pnpm, the `onlyBuiltDependencies` line too.
- **A web framework** — supplied by your project for an in-process app; the adapter only needs an object with a `request()` method, so it is not a peer.

Full detail, and what the tarball leaves behind: [docs/04](docs/04-operating.md).

## Docs

- The corpus: [docs/README.md](docs/README.md) — the spine, one chapter per kind, the shared references, the enforcement.
- API reference: [docs/reference/](docs/reference/) — compiled from source by `npm run docs`.
- Agent skill: [skills/jterrazz-test/](skills/jterrazz-test/) — the fork, the mental model, and a generated signature card per kind.
