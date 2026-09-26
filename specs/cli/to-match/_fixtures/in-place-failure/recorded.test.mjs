import { expect, test } from 'vitest';

const { specification } = await import(process.env.IN_PLACE_ENTRY);
const { integration } = await specification.integration({});

test('records a value in place', async () => {
    const result = await integration.call(() => ({ id: 'order-1', lines: 2 }));
    expect(result.value).toMatch('');
});

test('fails after the value above was recorded', () => {
    const marker = 'the failing line';
    expect(marker).toBe('another line');
});
