import { expect, test } from 'vitest';

import { match } from '@jterrazz/test';

test('captures a ref used only once', async () => {
    // Given - a response
    const result = await run();

    // Then - the ref never asserts equality against a second occurrence (D9 warn)
    expect(result.value).toEqual({ id: match.ref('order') });
});
