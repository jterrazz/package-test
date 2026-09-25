import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { startAppiumServer } from './appium-server.js';

describe('startAppiumServer', () => {
    test('refuses a root with no appium binary, naming the install command', async () => {
        // Given - a project root where appium was never installed (the run's temp root removes it)
        const root = mkdtempSync(resolve(tmpdir(), 'appium-root-'));

        // Then - the refusal is the exact fix, and nothing is spawned
        await expect(startAppiumServer(root)).rejects.toThrow(
            'npm install -D appium webdriverio && npx appium driver install xcuitest',
        );
    });
});
