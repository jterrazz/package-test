import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { MOBILE_SESSIONS_DIR, sessionLedger } from '../seams/appium/session-ledger.js';
import setup from './mobile-session.js';

describe('the mobile session setup — one driver session per run', () => {
    test('hands the project a ledger of its own, and clears it at teardown', async () => {
        // Given - a project root, and the setup run for it
        const root = mkdtempSync(join(tmpdir(), 'mobile-session-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const provided = new Map<string, unknown>();
        const teardown = await setup({
            config: { root },
            provide: (key: string, value: unknown) => {
                provided.set(key, value);
            },
        });

        // When - a runner records the session it opened, and the run ends
        const ledger = String(provided.get('mobileSessions'));
        sessionLedger(ledger).record(
            {},
            { capabilities: {}, serverUrl: 'http://127.0.0.1:1', sessionId: 's-1' },
        );
        await teardown();

        // Then - the ledger sat under the run's artefacts, and is gone once the run ended
        expect(ledger.startsWith(join(root, MOBILE_SESSIONS_DIR))).toBe(true);
        expect(existsSync(ledger)).toBe(false);
    });
});
