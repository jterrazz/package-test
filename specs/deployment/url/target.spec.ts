import { describe, expect, test } from 'vitest';

import { deployment as strict } from '../strict.specification.js';

describe('target', () => {
    test('a path, where the specification names no url to read it from, is refused', async () => {
        // Given - a specification with no base, handed a path
        // Then - refused, naming the path
        await expect(strict.get('/health')).rejects.toThrow(
            [
                'found: "/health", a path, and the specification names no `url` to read it from',
                'why: An exchange goes to one absolute http(s) URL: written whole, or a path from the `url` the specification names.',
                'fix: write the URL whole, or name the base with `specification.deployment({ url })`',
                'read: docs/guides/deployment-specs.md#the-target',
            ].join('\n'),
        );
    });
});
