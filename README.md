*Hey there – I’m Jean-Baptiste, just another developer doing weird things with code. All my projects live on [jterrazz.com](https://jterrazz.com) – complete with backstories and lessons learned. Feel free to poke around – you might just find something useful!*

# @jterrazz/test

Mocking utilities for TypeScript testing.

## Installation

```bash
npm install -D @jterrazz/test vitest
```

**Optional:** For API mocking with MSW:

```bash
npm install -D msw
```

## Usage

### Date Mocking

```typescript
import { describe, test, expect, afterEach } from 'vitest';
import { mockOfDate } from '@jterrazz/test';

describe('Date Tests', () => {
  afterEach(() => {
    mockOfDate.reset();
  });

  test('should mock dates', () => {
    const fixedDate = new Date('2024-01-01');
    mockOfDate.set(fixedDate);

    expect(new Date()).toEqual(fixedDate);
  });
});
```

### Deep Mocking

```typescript
import { describe, test, expect } from 'vitest';
import { mockOf } from '@jterrazz/test';

interface UserService {
  getUser: (id: string) => Promise<{ id: string; name: string }>;
}

describe('Mock Tests', () => {
  test('should use deep mocks', async () => {
    const mockUserService = mockOf<UserService>();

    mockUserService.getUser.mockResolvedValue({ id: '1', name: 'John' });

    const user = await mockUserService.getUser('1');
    expect(user).toEqual({ id: '1', name: 'John' });
  });
});
```

## API

| Export | Description |
|--------|-------------|
| `mockOfDate` | Date mocking utilities (`set`, `reset`) |
| `mockOf<T>()` | Create deep mock of any interface |
| `MockDatePort` | Type interface for date mocking |
| `MockPort` | Type interface for deep mocking |

## Peer Dependencies

- `vitest` (required)
- `msw` (optional)
