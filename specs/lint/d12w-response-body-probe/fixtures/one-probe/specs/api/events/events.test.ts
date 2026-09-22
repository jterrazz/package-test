import { expect, test } from 'vitest';

test('probes a single field below the threshold', () => {
    // Given - an API result
    const result = call();

    // Then - one scalpel probe, silent: no cluster, no D12 diagnostic
    expect(result.response.body).toMatchObject({ ok: true });
});
