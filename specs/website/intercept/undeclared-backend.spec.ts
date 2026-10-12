import { http } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

describe('undeclared-backend', () => {
    test('a stub declared on a runner with no backend is refused as it is stated, naming the option that declares one', () => {
        // Given - the site's runner, which declares no stub backend
        // Then - the call is refused before any page opens
        expect(() =>
            website.intercept(http.get('https://news.test/latest'), http.json({ items: [] })),
        ).toThrow(
            [
                'found: .intercept(), and this runner has no declared backend',
                'why: A site, an app or a binary is served its stubs by a declared stub backend, the URL it reads in place of its API.',
                "fix: add `backend` to the specification options: specification.website({ …, backend: { env: 'API_URL' } })",
                'read: docs/guides/website-specs.md#declared-backend',
            ].join('\n'),
        );
    });
});
