# Jobs specs — `specification.jobs()`

Operative reference. Prose + examples: [docs/03-jobs.md](../../docs/03-jobs.md). Mocking provider calls: [references/contracts.md](contracts.md). Tokens: [references/tokens.md](tokens.md).

Background jobs run **in-process by definition** — no HTTP server, no `mode`. `specification.jobs()` never reads `TEST_MODE`; its services always start via testcontainers.

## Runner (in `*.specification.ts`, `afterAll(cleanup)`)

```typescript
export const { jobs, cleanup } = await specification.jobs({
    services: { db: postgres() },
    jobs: ({ db }) => [nightlyReport(db)], // (services) => JobHandle[], or a static array
});
afterAll(cleanup);
```

Returns `{ jobs, cleanup, orchestrator }`. A `JobHandle` is `{ name: string; execute: () => Promise<void> }`.

## Setup + action

| Method                                         | Description                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `.seed("file.sql", { database? })`             | Load SQL from `seeds/` — `database` = record key (MANDATORY ≥ 2 DBs, else forbidden, A7) |
| `.intercept(contract)` / `(trigger, response)` | Stub an outgoing provider/HTTP call — [contracts.md](contracts.md). STRICT (D7)          |
| `.trigger("name")` → `BaseResult`              | **Terminal.** Execute the registered job named `name`                                    |

- `.trigger(name)` takes a stable **kebab-case** identifier (`nightly-report`) — it is a contract between the app and its tests (B8). No competing vocabulary (`task`, `worker`, `cron`).
- Intercepts always work here (jobs are always node) — the natural home for provider-failure specs (`openai.error(429)`, `anthropic.timeout()`).

## Assertions

Assert the resulting database state and any intercept consumption:

```typescript
const result = await jobs.seed('pending.sql').intercept(classifyProduct).trigger('nightly-report');
await expect(result.table('products')).toMatchRows({ columns: ['status'], rows: [['classified']] });
```

`BaseResult` carries the shared accessors (`table`, `file`, `directory`) — see [docs/05-assertions.md](../../docs/05-assertions.md).

## Folder layout

```
specs/jobs/
├── jobs.specification.ts        # factory form
├── static-jobs.specification.ts # static-array form
└── triggering/
    ├── triggering.test.ts
    ├── seeds/
    ├── contracts/
    └── expected/
```
