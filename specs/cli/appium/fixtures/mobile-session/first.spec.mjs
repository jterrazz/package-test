import { afterAll, expect, inject, test } from 'vitest';

const { specification } = await import(process.env.IN_PLACE_ENTRY);
const { cleanup, mobile } = await specification.mobile({
    app: { bundleId: 'com.jterrazz.specimen' },
    appium: { url: inject('appiumDouble') },
    device: { name: 'iPhone 17' },
});

afterAll(cleanup);

test('the first file opens the app', async () => {
    const result = await mobile.open();
    expect(result.content.text).toBe('Welcome to Specimen\nSign in');
});
