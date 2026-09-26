import { describe, expect, test } from 'vitest';

import { match } from '@jterrazz/test';

describe('widget', () => {
test('captures a ref used only once', async () => {
    // Given - a response
    const result = await run();

    // Then - the ref never asserts equality against a second occurrence (`no-single-use-ref` warn)
    expect(result.value).toEqual({ id: match.ref('order') });
});
});
