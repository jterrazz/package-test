import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import setup from './in-place.global-setup.js';
import { renderText, writeInPlace } from './in-place.js';

describe('setup', () => {
    test('the in-place setup — each run stages its rewrites in a folder of its own under the vitest artifacts, never among the project files', () => {
        // Given - a project the setup provides for
        const provided: [string, string][] = [];

        // When - the run starts
        setup({
            config: { root: '/projects/app' },
            provide: (key, value) => {
                provided.push([key, value]);
            },
        });

        // Then - the one folder provided is the run's, under .artifacts/vitest/in-place/
        expect(
            provided.map(([key, folder]) => [key, folder.replace(/[\da-f-]{36}$/u, '<run>')]),
        ).toStrictEqual([['inPlaceRewrites', '/projects/app/.artifacts/vitest/in-place/<run>']]);
    });

    test('the in-place setup — the run’s end writes the rewrites its tests left pending', () => {
        // Given - a project whose run left one value pending for a test file
        const root = mkdtempSync(join(tmpdir(), 'in-place-setup-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const file = join(root, 'scratch.test.ts');
        writeFileSync(file, 'expect(one).toMatch(``);\n');
        let folder = '';
        const teardown = setup({
            config: { root },
            provide: (_key, value) => {
                folder = value;
            },
        });
        writeInPlace(
            { column: 13, file, line: 1 },
            (indent) => renderText('first', indent),
            folder,
        );

        // When - the run ends
        teardown();

        // Then - the test file holds the value
        expect(readFileSync(file, 'utf8')).toBe('expect(one).toMatch(`first`);\n');
    });
});
