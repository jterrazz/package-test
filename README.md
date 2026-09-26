# @jterrazz/test

Declarative testing framework for modules, APIs, jobs, CLIs, rendered components, websites and native apps. Six constructors — `specification.api()`, `specification.job()`, `specification.cli()`, `specification.integration()`, `specification.website()`, `specification.mobile()` — plus the `component` chain, which starts nothing and needs none, and the module test, which needs neither.

A spec reads as a sentence: given → action → assertions. The vitest test name is its only description, every assertion goes through `expect()` with subject-typed matchers, and the infrastructure a spec declares — Postgres, Redis, SQLite, a child process, a real Chromium, an iOS simulator — is started, isolated per worker and cleaned up for you.

```bash
npm install -D @jterrazz/test @jterrazz/typescript vitest
```

Everything a spec needs imports from `@jterrazz/test`; the entries beside it are tools no spec imports, and they are listed once — [docs/01 § What the tree publishes](docs/01-architecture.md#what-the-tree-publishes).

## One kind of test, one example

Which kind a test is, is the first question — [the fork](docs/18-conventions.md#the-fork--which-kind-of-test-this-is) asks it in nine lines and the answer fixes the folder, the constructor and the project.

**A module** — beside its code, nothing started ([docs/05](docs/05-module-tests.md)):

```typescript
// src/domain/ranking.test.ts
import { clock } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { rank } from './ranking.js';

describe('rank', () => {
    test('ranks a fresher post above an older one of equal score', () => {
        // Given - two posts of equal score, one written this morning
        using _ = clock.at('2026-03-04T09:30:00Z');

        // Then - the fresher one leads
        expect(rank(posts).map((post) => post.id)).toStrictEqual(['fresh', 'stale']);
    });
});
```

**An integration spec** — a module against the real thing, or against a golden ([docs/06](docs/06-integration.md)):

```typescript
// specs/integration/posts/find.spec.ts
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { findPost } from '../../../src/posts/find-post.js';
import { integration } from '../integration.specification.js';

describe('find', () => {
    test('finds the post the migration wrote', async () => {
        // Given - a seeded database
        const result = await integration
            .seed(file('./_seeds/posts.sql'))
            .call(({ db }) => findPost(db, 'p-1'));

        // Then - the row comes back as the repository shapes it
        expect(result.value).toMatch(file('./_expected/found.json'));
    });
});
```

**A component** — a rendered unit in a real browser, beside its code ([docs/07](docs/07-component.md)):

```tsx
// src/presentation/post-table.test.tsx
import { component, content, defineStub, file, http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { PostTable } from './post-table.js';

const listing = defineStub({
    request: http.get('/api/posts'),
    response: http.json({ posts: [{ id: 1, title: 'A first post' }], total: 200 }),
});

describe('PostTable', () => {
    test('says how much of the collection the table is showing', async () => {
        // Given - a page of one row answering for a collection of two hundred
        const result = await component.intercept(listing).render(<PostTable />, async (visitor) => {
            await visitor.see(content('Showing 1 of 200 posts'));
        });

        // Then - the table is qualified by what it is not showing
        await expect(result.tree).toMatch(file('./_expected/one-of-two-hundred.aria.yaml'));
    });
});
```

**A website** — the served page, driven in a browser ([docs/08](docs/08-website.md)):

```typescript
// specs/website/subscribe/subscribe.spec.ts
import { button, content, field } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('subscribe', () => {
    test('subscribes through the form and captures the final state', async () => {
        // Given - a visitor on the homepage
        const result = await website.visit('/', async (visitor) => {
            await visitor.fill(field('Email'), 'visitor@site.test');
            await visitor.click(button('Subscribe'));
            await visitor.see(content('Thanks for subscribing'));
        });

        // Then - the page says so, and the console is clean
        expect(result.content.text).toContain('Thanks for subscribing');
        expect(result.errors.text).toBe('');
    });
});
```

**A mobile screen** — the installed app on a simulator ([docs/09](docs/09-mobile.md)):

```typescript
// specs/mobile/events/bookmark.spec.ts
import { button, content } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { mobile } from '../mobile.specification.js';

describe('bookmark', () => {
    test('bookmarks an event from its detail screen', async () => {
        // Given - a visitor on the events feed
        const result = await mobile.open('news://events', async (visitor) => {
            await visitor.tap(button('Fauci inquiry'));
            await visitor.see(content('reports'));
            await visitor.tap(button('Bookmark'));
        });

        // Then - the capture reflects the screen after the interaction
        expect(result.content.text).toContain('Bookmarked');
    });
});
```

**An API** — the assembled app, met through a complete HTTP exchange, the whole response written where the test reads it ([docs/10](docs/10-api.md)):

```typescript
// specs/api/users/create/shape.spec.ts
import { describe, expect, test } from 'vitest';

import { api } from '../../api.specification.js';

describe('shape', () => {
    test('creates a user and answers with it', async () => {
        // Given - the complete request
        const result = await api.post('/users', { name: 'Alice' });

        // Then - the whole response, and the row it wrote
        expect(result.response).toMatch(`
            HTTP/1.1 201 Created
            content-type: application/json

            {"id": "{{uuid}}", "name": "Alice"}
        `);
        await expect(result.table('users')).toMatch([['{{uuid}}', 'Alice']]);
    });
});
```

**A job** — what a name triggers, in-process ([docs/11](docs/11-job.md)):

```typescript
// specs/job/digest/daily-digest.spec.ts
import { file } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { job } from '../job.specification.js';

describe('daily-digest', () => {
    test('writes one digest row per active subscriber', async () => {
        // Given - two subscribers, from the seed beside the test
        const result = await job.seed(file('./_seeds/two-subscribers.sql')).trigger('daily-digest');

        // Then - the whole table
        await expect(result.table('digests')).toMatch([
            [1, 'a@site.test'],
            [2, 'b@site.test'],
        ]);
    });
});
```

**A CLI** — the built binary, usually as a document ([docs/12](docs/12-cli.md)):

```yaml
# specs/cli/scaffold/new-project.spec.yaml
description: scaffolds a project into an empty directory
fixture: ./_fixtures/empty-dir/
runs:
    - command: new my-app
      exit: 0
      stdout: |
          Scaffolded my-app in {{workdir}}/my-app
      files:
          my-app/package.json: exists
```

## The map

Everything is stated ONCE, in the chapter that owns it — a second copy here would be a second answer, and the one a reader meets first is the one that goes stale. The corpus map is [docs/README.md](docs/README.md).

| Subject                                                          | Chapter                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| What the framework is, its trees, its channels, its four entries | [docs/01](docs/01-architecture.md)                               |
| Installing it, the preset, the project helpers                   | [docs/02](docs/02-developing.md#vitest-config-the-preset)        |
| What a consumer must bring: the peers, Docker, the pinned pair   | [docs/04](docs/04-operating.md#what-a-consumer-must-bring)       |
| Each kind of test, one chapter, the same spine of sections       | [docs/05](docs/05-module-tests.md)–[docs/12](docs/12-cli.md)     |
| A cli session written as data: the `<case>.spec.yaml`            | [docs/20](docs/20-documents.md)                                  |
| Naming an element: descriptors, verbs, `within`, exact names     | [docs/13](docs/13-elements.md)                                   |
| Every matcher, by subject                                        | [docs/14](docs/14-assertions.md)                                 |
| The `{{token}}` grammar, `#ref` captures, update mode            | [docs/15](docs/15-tokens.md)                                     |
| Stubs, selection, provider builders, `intercept()`               | [docs/16](docs/16-stubs.md)                                      |
| Services, init scripts, per-worker isolation, `process()`        | [docs/17](docs/17-services.md)                                   |
| The conventions, and the catalogue that enforces them            | [docs/18](docs/18-conventions.md), [docs/19](docs/19-linting.md) |

The conventions are not prose alone: the package ships an oxlint plugin (`@jterrazz/test/oxlint`) and a `jterrazz-test-check` binary that reads the fixtures and cross-file relationships oxlint cannot. Every diagnostic teaches in four parts — what it found, why the convention holds, the fix for this case, and the catalogue row to read.

Node 24, vitest 5 and `@jterrazz/typescript` 11 are the required peers; everything else — a browser, a database driver, a simulator — is an optional peer, loaded the first time a spec needs it and named in the refusal when it is not there. What to install, and when: [docs/04](docs/04-operating.md#what-a-consumer-must-bring).

## Docs

- The corpus: [docs/README.md](docs/README.md) — the spine, one chapter per kind, the shared references, the enforcement.
- The API: the types the package publishes — your editor reads them.
- Agent skill: [skills/jterrazz-test/SKILL.md](skills/jterrazz-test/SKILL.md) — which kind of test, the pitfalls, and the chapter to read next.
