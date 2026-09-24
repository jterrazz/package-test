import { afterAll, expect, test } from 'vitest';

const { specification } = await import(process.env.IN_PLACE_ENTRY);
const { cleanup, mobile } = await specification.mobile({
    app: { bundleId: 'com.jterrazz.specimen' },
    device: { name: 'iPhone 17' },
    root: './app',
});

afterAll(cleanup);

test('the second file opens the app', async () => {
    const result = await mobile.open();
    expect(result.content.text).toBe('Welcome to Specimen\nSign in');
});
