import { sectionOf } from '@jterrazz/typescript/rules';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
    heldPixelBytes,
    heldUnreached,
    lowerMeasured,
    recordUnreached,
    writeBaseline,
} from '../test-baseline.js';

const FILE = '.studio/baseline.json';

function ledgerRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
    mkdirSync(join(root, '.studio'));

    return root;
}

describe('test-baseline', () => {
    test("the test ratchet — a recording keeps the routes the run holds, which are the run's", () => {
        // Given - a test section holding a checker key and the run's route key
        const root = ledgerRoot();
        writeFileSync(
            join(root, FILE),
            '{\n    "test": { "jterrazz-check/old": 1, "routes/unreached": 2 }\n}\n',
        );

        // When - the checker records its own counts, none of which is a route
        writeBaseline(root, { 'jterrazz-check/new': 1 });

        // Then - the whole file holds the new count beside the route key
        expect(readFileSync(join(root, FILE), 'utf8')).toBe(
            '{\n    "test": {\n        "jterrazz-check/new": 1,\n        "routes/unreached": 2\n    }\n}\n',
        );
    });

    test('the test ratchet — the run records its routes beside the checker keys, and drops its key at zero', () => {
        // Given - a test section the checker wrote
        const root = ledgerRoot();
        writeFileSync(join(root, FILE), '{\n    "test": { "jterrazz-check/old": 1 }\n}\n');

        // When - the run records three unreached routes, then none
        recordUnreached(root, 3);
        const held = heldUnreached(root);
        recordUnreached(root, 0);

        // Then - the count was held, and zero leaves the checker's key alone
        expect(held).toBe(3);
        expect(sectionOf(root, 'test')).toStrictEqual({ 'jterrazz-check/old': 1 });
    });

    test('the test ratchet — a fix lowers a measured key to where the tree stands, in place, and drops it at zero', () => {
        // Given - a section holding two measured keys and a count
        const root = ledgerRoot();
        writeFileSync(
            join(root, FILE),
            '{\n    "test": { "a/bytes": 500, "jterrazz-check/x": 1, "pixel-goldens/bytes": 300 }\n}\n',
        );

        // When - one quantity fell, the other reached zero, and an unheld one rose
        const lines = lowerMeasured(root, {
            'a/bytes': 0,
            'new/bytes': 9,
            'pixel-goldens/bytes': 160,
        });

        // Then - each fall re-recorded and named, nothing raised, nothing added
        expect([lines, heldPixelBytes(root), readFileSync(join(root, FILE), 'utf8')]).toStrictEqual(
            [
                [
                    're-recorded .studio/baseline.json › test › a/bytes from 500 to 0',
                    're-recorded .studio/baseline.json › test › pixel-goldens/bytes from 300 to 160',
                ],
                160,
                '{\n    "test": {\n        "jterrazz-check/x": 1,\n        "pixel-goldens/bytes": 160\n    }\n}\n',
            ],
        );
    });

    test('the test ratchet — a measured key at or above its entry is left as recorded', () => {
        // Given - a section holding the pixel bytes
        const root = ledgerRoot();
        const held = '{\n    "test": { "pixel-goldens/bytes": 300 }\n}\n';
        writeFileSync(join(root, FILE), held);

        // When - the tree holds as much, then more
        const lines = [
            ...lowerMeasured(root, { 'pixel-goldens/bytes': 300 }),
            ...lowerMeasured(root, { 'pixel-goldens/bytes': 400 }),
        ];

        // Then - nothing re-recorded, the file byte for byte
        expect([lines, readFileSync(join(root, FILE), 'utf8')]).toStrictEqual([[], held]);
    });

    test('the test ratchet — a file that is not JSON refuses a recording, which would lose what it holds', () => {
        // Given - a family file that is not JSON
        const root = ledgerRoot();
        writeFileSync(join(root, FILE), 'not json');

        // Then - the recording is refused
        expect(() => {
            writeBaseline(root, { 'jterrazz-check/x': 1 });
        }).toThrow('then record again');
    });
});
