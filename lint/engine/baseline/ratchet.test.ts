import { sectionOf } from '@jterrazz/typescript/rules';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { heldUnreached, recordUnreached, writeBaseline } from './ratchet.js';

const FILE = 'jterrazz.baseline.json';

describe('ratchet', () => {
    test("the test ratchet — a recording keeps the routes the run holds, which are the run's", () => {
        // Given - a test section holding a checker key and the run's route key
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
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
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, FILE), '{\n    "test": { "jterrazz-check/old": 1 }\n}\n');

        // When - the run records three unreached routes, then none
        recordUnreached(root, 3);
        const held = heldUnreached(root);
        recordUnreached(root, 0);

        // Then - the count was held, and zero leaves the checker's key alone
        expect(held).toBe(3);
        expect(sectionOf(root, 'test')).toStrictEqual({ 'jterrazz-check/old': 1 });
    });

    test('the test ratchet — a file that is not JSON refuses a recording, which would lose what it holds', () => {
        // Given - a family file that is not JSON
        const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
        writeFileSync(join(root, FILE), 'not json');

        // Then - the recording is refused
        expect(() => {
            writeBaseline(root, { 'jterrazz-check/x': 1 });
        }).toThrow('then record again');
    });
});
