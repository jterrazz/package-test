import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProvidedContext } from 'vitest';
import { describe, expect, test } from 'vitest';

import setup, { mobileSessionSetup } from './mobile-session.global-setup.js';
import { MOBILE_SESSIONS_DIR } from './session-ledger.js';

describe('setup', () => {
    test('mobileSessionSetup — names this module as the global setup, read from source', () => {
        // Given - the module run from source
        // Then - the source file beside it
        expect(mobileSessionSetup()).toBe(
            join(import.meta.dirname, 'mobile-session.global-setup.ts'),
        );
    });

    test('setup — a project with no device provides a ledger folder of its own under the root, and its teardown removes it', async () => {
        // Given - a project that declares no device
        const root = mkdtempSync(join(tmpdir(), 'mobile-session-'));
        const provided: Partial<ProvidedContext> = {};
        const teardown = await setup({
            config: { root },
            provide: (key, value) => {
                Object.assign(provided, { [key]: value });
            },
        });
        const directory = String(provided.mobileSessions);
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, 'note.txt'), '');

        // When - the run ends
        await teardown();

        // Then - the folder was the run's own, and no server was provided
        expect([
            directory.startsWith(join(root, MOBILE_SESSIONS_DIR)),
            Object.keys(provided),
            existsSync(directory),
        ]).toStrictEqual([true, ['mobileSessions'], false]);
    });

    test('setup — a project declaring a device serves Appium for it from its root, and is refused a simulator it cannot boot', async () => {
        // Given - a project declaring a device no machine has
        const root = mkdtempSync(join(tmpdir(), 'mobile-session-'));
        const provided: Partial<ProvidedContext> = {};

        // Then - the setup refuses before it provides a server
        await expect(
            setup({
                config: {
                    provide: {
                        mobileAppium: {
                            device: { name: 'Nothing', udid: 'NO-SUCH-UDID' },
                            root: '.',
                        },
                    },
                    root,
                },
                provide: (key, value) => {
                    Object.assign(provided, { [key]: value });
                },
            }),
        ).rejects.toThrow('could not boot simulator NO-SUCH-UDID');
        expect(Object.keys(provided)).toStrictEqual(['mobileSessions']);
    });
});
