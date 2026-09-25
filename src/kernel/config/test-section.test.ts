import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { testSectionAt } from './test-section.js';

/** A unit whose `jterrazz.config.ts` is `source`, or that has none; removed when the test ends. */
function unit(source?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'test-section-'));
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    if (source !== undefined) {
        writeFileSync(join(root, 'jterrazz.config.ts'), source);
    }
    return root;
}

describe('test-section', () => {
    test('the test section of jterrazz.config.ts, as the run reads it — the routes document and the method-less paths a member declares are read, types stripped', async () => {
        // Given - a member declaring an OpenAPI document and one method-less route
        const root = unit(
            "const routes: string = './openapi.yaml';\nexport default { test: { methodless: ['/mcp'], routes } };\n",
        );

        // Then - both reach the run as declared
        await expect(testSectionAt(root)).resolves.toStrictEqual({
            methodless: ['/mcp'],
            routes: './openapi.yaml',
        });
    });

    test('the test section of jterrazz.config.ts, as the run reads it — no file, and a key of the wrong shape, are no settings', async () => {
        // Given - a unit with no config, and one whose routes is not a path
        const roots = [unit(), unit('export default { test: { routes: 42 } };\n')];

        // Then - neither declares anything the run would half-use
        await expect(Promise.all(roots.map(testSectionAt))).resolves.toStrictEqual([{}, {}]);
    });
});
