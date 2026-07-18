# @jterrazz/test v9 — Documentation

> **Maintenance note** — This documentation is living: when implementation or usage reveals a new edge case, document it in the relevant chapter in the same change.

`@jterrazz/test` is a declarative testing framework for APIs, background jobs, and CLIs. You describe a spec — seeds, intercepts, one terminal action — and assert on a precisely typed result with `expect()`. Fixtures are files (`requests/*.http`, `expected/*`, `contracts/*.ts`), dynamic values are matched with one unified `{{token}}` grammar, and infrastructure (Postgres, Redis, SQLite, Docker Compose) is started, isolated per vitest worker, and cleaned up for you. Three constructors, and only three: `specification.api()`, `specification.jobs()`, `specification.cli()`.

```typescript
test('creates a user', async () => {
    // Given - empty database
    const result = await api.request('create-user.http');

    // Then - status + headers + body via the fixture file; row in the database
    expect(result.response).toMatch('user-created.http');
    await expect(result.table('users')).toMatchRows({
        columns: ['name'],
        rows: [['Alice']],
    });
});
```

## Table of contents

| Chapter                                       | Covers                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [01 — Getting started](01-getting-started.md) | Install, peer dependencies, first API spec, first CLI spec, vitest projects config, `TEST_MODE` / `TEST_UPDATE` |
| [02 — API specs](02-api.md)                   | `specification.api()`: options, node vs compose, `.http` request files, inline actions, seeds, intercepts       |
| [03 — Jobs specs](03-jobs.md)                 | `specification.jobs()`: in-process pipelines, `.trigger()`, provider error cases                                |
| [04 — CLI specs](04-cli.md)                   | `specification.cli()`: `.exec()`, `.env()`, fixtures and projects, services, Docker-aware mode                  |
| [05 — Assertions](05-assertions.md)           | The reference: every matcher, grouped by subject, sync/async rules, `toMatch` resolution, diffs                 |
| [06 — Tokens](06-tokens.md)                   | The `{{token}}` grammar: all 21 tokens, `#ref` captures, `match.*`, update mode                                 |
| [07 — Contracts](07-contracts.md)             | `defineContract`, provider trigger/response builders, FIFO queueing, inline escape hatches                      |
| [08 — Services](08-services.md)               | `postgres` / `redis` / `sqlite`, the services record, compose conventions, per-worker isolation                 |
| [09 — Conventions](09-conventions.md)         | The normative rule set (`/CONVENTIONS.md`), the four enforcement channels, naming recap, retro-propagation (K)  |
| [10 — Linting](10-linting.md)                 | The oxlint plugin (`@jterrazz/test/oxlint`): rule catalogue, `recommendedRules`, the D4 conventions checker     |

## How this documentation is organized

- **Chapters 01–04** follow the three constructors: read 01, then the chapter matching what you test (API, jobs, or CLI).
- **Chapters 05–08** are references shared by all three facets: assertions, the token grammar, intercept contracts, and infrastructure services. They are heavily cross-linked from the constructor chapters.
- **Chapters 09–10** cover enforcement. Chapter 09 points at the normative rule set: every rule in `/CONVENTIONS.md` is authoritative, and the full mechanized set (each rule, its channel and text) lives in the generated [`/CONVENTIONS-CATALOG.md`](../CONVENTIONS-CATALOG.md); this documentation explains and illustrates those rules but never overrides them. Chapter 10 documents the static channel — the `@jterrazz/test/oxlint` plugin and the D4 conventions checker.

Every chapter ends with a **Pitfalls** section (the mistakes the framework is designed to catch) and a **Related** line linking to neighbouring chapters. All examples use the Given/Then comment convention that the framework itself enforces (rule B4).
