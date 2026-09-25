import { describe, expect, test } from 'vitest';

import { startWebsite } from './website.handle.js';

describe('specification.website() — what it refuses before starting anything', () => {
    test('a stub backend beside a deployed url is refused, for a caller the types do not reach', async () => {
        // Given - an untyped caller pointing a deployed site at a local stub
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the pair is what the type refuses; this test IS the caller the type does not reach
        const options = { backend: { env: 'API_URL' }, url: 'https://example.test' } as never;

        // Then - refused in the words of the type it slipped past: the deployed site would never call the stub
        await expect(startWebsite(options)).rejects.toThrow(
            'specification.website(): `backend` requires `server` mode — a deployed `url` cannot be pointed at a local stub.',
        );
    });
});
