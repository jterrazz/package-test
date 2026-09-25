import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';
import type { TestProject } from 'vitest/node';

import setup, { IN_PLACE_DIR } from './in-place-setup.js';
import { writeInPlace } from './in-place.js';

describe('setup', () => {
    test('the update-mode setup — rewrites written once the run is reported — hands the project a pending folder of its own, and writes what waits there at teardown', () => {
        // Given - a project root holding a scratch test, and the setup run for it
        const root = mkdtempSync(join(tmpdir(), 'in-place-setup-'));
        onTestFinished(() => {
            rmSync(root, { force: true, recursive: true });
        });
        const file = join(root, 'scratch.test.ts');
        writeFileSync(file, 'expect(one).toMatch(``);\n');
        const provided = new Map<string, unknown>();
        const project = {
            config: { root },
            provide: (key: string, value: unknown) => provided.set(key, value),
        } as unknown as TestProject;
        const teardown = setup(project);

        // When - a value is written in place through the folder it provided, and the run ends
        const folder = String(provided.get('inPlaceRewrites'));
        writeInPlace({ column: 13, file, line: 1 }, () => '`first`', folder);
        const before = readFileSync(file, 'utf8');
        teardown();

        // Then - the folder sat under the run's artefacts, and the test file changed only at teardown
        expect(folder.startsWith(join(root, IN_PLACE_DIR))).toBe(true);
        expect(before).toBe('expect(one).toMatch(``);\n');
        expect(readFileSync(file, 'utf8')).toBe('expect(one).toMatch(`first`);\n');
    });
});
