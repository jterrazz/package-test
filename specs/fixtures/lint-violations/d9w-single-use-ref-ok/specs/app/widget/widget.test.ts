import { expect, test } from 'vitest';

import { match } from '@jterrazz/test';

test('uses a plain matcher', async () => {
    // Given - a response
    const result = await run();

    // Then - no single-use capture ref
    expect(result.value).toEqual({ id: match.uuid() });
});
