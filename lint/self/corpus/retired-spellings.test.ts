import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { retiredSpellingsIn } from './retired-spellings.js';

const ROOT = resolve(import.meta.dirname, '../../..');

function treeWith(files: Record<string, string>): string {
    const root = mkdtempSync(resolve(tmpdir(), 'retired-spellings-'));
    for (const folder of ['docs/decisions', 'lint', 'skills', 'specs', 'src']) {
        mkdirSync(resolve(root, folder), { recursive: true });
    }
    writeFileSync(resolve(root, 'README.md'), '');
    for (const [path, text] of Object.entries(files)) {
        writeFileSync(resolve(root, path), text);
    }
    return root;
}

describe('retired-spellings', () => {
    test('a major carries no bridge (ADR-014) — no code, chapter, spec or skill of this repository writes a 16 spelling', () => {
        // Given - the repository as it stands, its negative inputs aside
        const found = retiredSpellingsIn(ROOT);

        // Then - nothing: a retired form a reader copies is a form the checker then refuses
        expect(found).toStrictEqual([]);
    });

    test('a major carries no bridge (ADR-014) — a retired spelling is found wherever it is written, and a decision record keeps its history', () => {
        // Given - one spelling in a spec, one in a chapter, one in a decision record
        const root = treeWith({
            'docs/decisions/001-old.md': 'toMatchRows was retired\n',
            'docs/guide.md': 'read `$FIXTURES/app/`\n',
            'src/a.spec.ts': '\nawait expect(table).toMatchRows([]);\n',
        });

        // Then - the two outside the records, each at its line
        expect(retiredSpellingsIn(root)).toStrictEqual([
            'docs/guide.md:1: $FIXTURES/',
            'src/a.spec.ts:2: toMatchRows',
        ]);
    });
});
