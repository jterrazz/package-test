import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { startAppiumServer } from './appium-server.js';

describe('startAppiumServer', () => {
    let root: string | undefined;

    afterEach(() => {
        if (root !== undefined) {
            rmSync(root, { force: true, recursive: true });
        }
    });

    test('refuses a root with no appium binary, naming the install command', async () => {
        // Given - a project root where appium was never installed
        root = mkdtempSync(resolve(tmpdir(), 'appium-root-'));

        // Then - the refusal is the exact fix, and nothing is spawned
        await expect(startAppiumServer(root)).rejects.toThrow(
            'npm install -D appium webdriverio && npx appium driver install xcuitest',
        );
    });
});
