# Package Typescript Test

This package provides Vitest configuration and testing utilities for TypeScript projects, including MSW (Mock Service Worker) setup for API mocking.

## Installation

Install the package using npm:

```bash
npm install -D @jterrazz/test
```

## Usage

1. Set up MSW for API mocking:

```typescript
// handlers.ts
import { http } from 'msw';
import { setupServer } from '@jterrazz/test';

// Define your API handlers
const handlers = [
  http.get('/api/example', () => {
    return new Response(JSON.stringify({ data: 'example' }));
  }),
];

// Setup MSW server
export const server = setupServer(...handlers);
```

2. You can now write your tests using Vitest and MSW!

```typescript
import { describe, test, expect } from '@jterrazz/test';
import { server } from './handlers';

describe('API Tests', () => {
  test('should handle API requests', async () => {
    const response = await fetch('/api/example');
    const data = await response.json();

    expect(data).toEqual({ data: 'example' });
  });
});
```

3. Using Date Mocking:

```typescript
import { mockOfDate } from '@jterrazz/test';

describe('Date Tests', () => {
  test('should mock dates', () => {
    const fixedDate = new Date('2024-01-01');
    mockOfDate.set(fixedDate);

    expect(new Date()).toEqual(fixedDate);

    // Reset the mock after your test
    mockOfDate.reset();
  });
});
```

4. Using Extended Mocking:

```typescript
import { mockOf } from '@jterrazz/test';

interface UserService {
  getUser: (id: string) => Promise<{ id: string; name: string }>;
}

describe('Mock Tests', () => {
  test('should use extended mocks', async () => {
    const mockUserService = mockOf<UserService>();

    // Setup mock behavior
    mockUserService.getUser.mockResolvedValue({ id: '1', name: 'John' });

    const user = await mockUserService.getUser('1');
    expect(user).toEqual({ id: '1', name: 'John' });
  });
});
```

## Features

- Vitest configuration with TypeScript support
- MSW integration for API mocking
- Mock date utilities for time-based testing
- Extended mocking capabilities with vitest-mock-extended

Happy testing! 🚀
