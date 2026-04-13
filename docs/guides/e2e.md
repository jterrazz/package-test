# `e2e()` mode

Starts your full `docker/compose.test.yaml` stack via `docker compose up`, then runs assertions over real HTTP against the deployed container. **Language-agnostic** — the service under test can be anything that speaks HTTP.

## Setup

```typescript
// tests/setup/e2e.specification.ts
import { afterAll } from 'vitest';
import { e2e } from '@jterrazz/test';

export const spec = await e2e({
    root: '../../',
});

afterAll(() => spec.cleanup());
```

App URL and database connection strings are auto-detected from the compose file.

## Writing a test

```typescript
import { test, expect } from 'vitest';
import { spec } from '../../setup/e2e.specification.js';

test('health check returns 200', async () => {
    // Given — the full stack running
    const result = await spec('health').get('/health').run();

    // Then
    expect(result.status).toBe(200);
});
```

## When to use this mode

- Service written in a language other than TypeScript (Go, Rust, Python…).
- You need to test cross-service behavior (app + cache + database together).
- You want the same tests to run locally and in CI against the same compose stack.

## Compose convention

```
docker/
├── compose.test.yaml   # Source of truth for the stack under test
└── postgres/
    └── init.sql        # Runs on container start
```

## See also

- [`e2e()` API reference](/reference/functions/e2e)
- [Directory snapshots](/guides/cli) (also available in e2e mode for file outputs)
