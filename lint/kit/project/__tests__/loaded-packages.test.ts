import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { packagesLoadedFor } from '../loaded-packages.js';

function tree(folders: readonly string[], files: Readonly<Record<string, string>> = {}): string {
    const root = mkdtempSync(join(tmpdir(), 'loaded-packages-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    for (const folder of folders) {
        mkdirSync(join(root, folder), { recursive: true });
    }
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
    }

    return root;
}

describe('packagesLoadedFor', () => {
    test('names the peers each project of a tree drives, once per kind of project, and none for a tree of module tests', () => {
        // Given - a tree with a website, a mobile and an api folder; one with a rendered test; one with a module test only
        const driving = tree(['specs/website', 'specs/mobile', 'specs/api']);
        const rendering = tree([], { 'src/ui/__tests__/panel.test.tsx': '' });
        const plain = tree([], { 'src/__tests__/orders.test.ts': '' });

        // Then - the mobile and the website peers; the component peers; and nothing
        expect([
            packagesLoadedFor(driving),
            packagesLoadedFor(rendering),
            packagesLoadedFor(plain),
        ]).toStrictEqual([
            ['appium', 'webdriverio', '@vitest/browser-playwright', 'playwright'],
            ['@vitest/browser-playwright', 'playwright', 'vitest-browser-react'],
            [],
        ]);
    });
});
