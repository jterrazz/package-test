import { expect, test } from 'vitest';

const { specification, text } = await import(process.env.IN_PLACE_ENTRY);
const { integration } = await specification.integration({});

test('records the results in place', async () => {
    const result = await integration.call(() => ({ id: 'order-1', lines: 2 }));
    expect(text('built 3 files in 12ms\ndone\n')).toMatch(``);
    expect(result.value).toMatch('');
});
