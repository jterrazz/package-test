import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { heldUnreached, recordUnreached } from './baseline.js';

function scratch(): string {
    const directory = mkdtempSync(join(tmpdir(), 'baseline-'));
    onTestFinished(() => {
        rmSync(directory, { force: true, recursive: true });
    });
    return directory;
}

describe('baseline', () => {
    test('route coverage — the ratchet — recording keeps every other key of the file, and removes its own at zero', () => {
        // Given - a baseline holding a typescript section and a checker key
        const root = scratch();
        const path = join(root, 'jterrazz.baseline.json');
        writeFileSync(
            path,
            '{\n    "typescript": { "a": 1 },\n    "test": { "jterrazz/x": 2 }\n}\n',
        );

        // When - two unreached routes are recorded, then none
        recordUnreached(root, 2);
        const recorded = heldUnreached(root);
        recordUnreached(root, 0);

        // Then - held, then gone, the other keys untouched
        expect(recorded).toBe(2);
        expect(JSON.parse(readFileSync(path, 'utf8'))).toStrictEqual({
            test: { 'jterrazz/x': 2 },
            typescript: { a: 1 },
        });
    });
});
