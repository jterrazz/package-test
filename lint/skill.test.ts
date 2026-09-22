import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { SKILL_MAX_LINES, skillFindings } from './skill.js';

const ROOT = resolve(import.meta.dirname, '..');
const SKILL = resolve(ROOT, 'skills/jterrazz-test/SKILL.md');

describe('the skill names only what exists (meta-test)', () => {
    test(`stays under ${SKILL_MAX_LINES} lines`, () => {
        // Given - the hand-written skill
        const lines = readFileSync(SKILL, 'utf8').split('\n');

        // Then - it decides and routes; the chapters explain
        expect(lines.length).toBeLessThanOrEqual(SKILL_MAX_LINES);
    });

    test('cites no symbol the entries do not publish, and no chapter that is not on disk', () => {
        // Given - the committed skill
        // Then - every import, every call and every chapter link resolves
        expect(skillFindings(SKILL, ROOT)).toStrictEqual({
            missingChapters: [],
            unknownCalls: [],
            unknownImports: [],
        });
    });

    test('names what a false page cites', () => {
        // Given - a skill beside the real one, citing a symbol and a chapter that do not exist
        const scratch = mkdtempSync(join(tmpdir(), 'skill-'));
        const page = join(scratch, 'SKILL.md');
        writeFileSync(
            page,
            [
                "import { fakeOf, specification } from '@jterrazz/test';",
                'Double the port with `fakeOf<T>()`, then scope with `within(…)`.',
                'Read [the chapter](./docs/99-gone.md).',
            ].join('\n'),
        );

        // Then - each falsehood is named, and the true names pass
        expect(skillFindings(page, ROOT)).toStrictEqual({
            missingChapters: ['./docs/99-gone.md'],
            unknownCalls: ['fakeOf'],
            unknownImports: ['fakeOf from @jterrazz/test'],
        });
    });
});
