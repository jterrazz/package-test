import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { FORK, spliceFork } from './fork.js';

const ROOT = resolve(import.meta.dirname, '../..');

describe('fork', () => {
    test('the fork — generation freshness (meta-test) — the fork table inside chapter 18 is byte-identical to a fresh splice', () => {
        // Given - the committed constitution
        const committed = readFileSync(resolve(ROOT, 'docs/18-conventions.md'), 'utf8');

        // Then - splicing a fresh table changes nothing
        expect(spliceFork(committed)).toBe(committed);
    });

    test('the fork — generation freshness (meta-test) — asks nine questions, one per kind, the module alone second to last', () => {
        // Given - the rows of the fork, in the order they are asked
        const kinds = FORK.map((row) => row.kind);

        // Then - no kind is asked twice, and the module is what is left when every assembled kind failed
        expect(new Set(kinds).size).toBe(9);
        expect(kinds.at(-2)).toBe('module');
    });
});
