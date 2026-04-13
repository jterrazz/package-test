# Overview

`@jterrazz/test` is a declarative testing framework for APIs and CLIs. It exposes a single fluent builder API with three execution modes — each handles infrastructure, wiring, and cleanup automatically.

## Installation

```bash
npm install -D @jterrazz/test vitest
```

Peer dependencies: `vitest`, optionally `hono` (only for `integration()` mode) and `msw` (planned).

## The three modes at a glance

| Mode                             | Infrastructure                         | App execution                           | Use when                                                       |
| -------------------------------- | -------------------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| [`integration()`](./integration) | testcontainers (real DBs in Docker)    | In-process via Hono adapter             | Fastest feedback loop for HTTP-layer tests with real databases |
| [`e2e()`](./e2e)                 | `docker compose up` of your full stack | Real HTTP against the running container | Language-agnostic black-box tests of your deployed service     |
| [`cli()`](./cli)                 | Optional (services via testcontainers) | Child process in a fresh temp dir       | Testing CLI binaries, scaffolding tools, codegen output        |

## A first test

The builder shape is always `spec("label") → setup → action → assertions`:

```typescript
import { test, expect } from 'vitest';
import { spec } from '../setup/integration.specification.js';

test('creates a user and returns 201', async () => {
    // Given — two existing users
    const result = await spec('creates user')
        .seed('initial-users.sql')
        .post('/users', 'new-user.json')
        .run();

    // Then — user created, all three present in the table
    expect(result.status).toBe(201);
    await result.table('users').toMatch({
        columns: ['name'],
        rows: [['Alice'], ['Bob'], ['Charlie']],
    });
});
```

## Next steps

- [Writing tests](./writing-tests) — the Given/Then convention and file layout
- [integration()](./integration) — in-process HTTP with real containers
- [e2e()](./e2e) — full docker-compose stack
- [cli()](./cli) — CLI binaries, directory snapshots, env vars
- [API reference](/reference/) — every export, auto-generated from source
