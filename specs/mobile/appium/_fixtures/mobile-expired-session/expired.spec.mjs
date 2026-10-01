import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, expect, inject, test } from 'vitest';

const { specification } = await import(process.env.IN_PLACE_ENTRY);

async function runner() {
    const { cleanup, mobile } = await specification.mobile({
        app: { bundleId: 'com.jterrazz.specimen' },
        appium: { url: inject('appiumDouble') },
        device: { name: 'iPhone 17' },
    });
    afterAll(cleanup);
    return mobile;
}

async function expireTheRunsSessions() {
    const ledger = inject('mobileSessions');
    for (const name of readdirSync(ledger)) {
        const { serverUrl, sessionId } = JSON.parse(readFileSync(join(ledger, name), 'utf8'));
        await fetch(`${serverUrl}/session/${sessionId}`, { method: 'DELETE' });
    }
}

const first = await runner();
const second = await runner();

test('a runner opens the app on the session the server expired after an earlier runner drove it', async () => {
    expect((await first.open()).content.text).toBe('Welcome to Specimen\nSign in');
    await expireTheRunsSessions();
    expect((await second.open()).content.text).toBe('Welcome to Specimen\nSign in');
});
