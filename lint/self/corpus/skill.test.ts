import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { FORK } from '../../consumer/catalogue/fork.js';
import { SKILL_MAX_LINES, skillFindings } from './skill.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const SKILL = resolve(ROOT, 'skills/jterrazz-test/SKILL.md');

/** `N. <question> → **<kind>**, `<path>``. */
const SKILL_FORK_LINE = /^\d+\. .*→ \*\*(?<kind>[^*]+)\*\*, `(?<path>[^`]+)`/gmu;
describe('skill', () => {
    test(`the skill names only what exists (meta-test) — stays under ${SKILL_MAX_LINES} lines`, () => {
        // Given - the hand-written skill
        const lines = readFileSync(SKILL, 'utf8').split('\n');

        // Then - it decides and routes; the chapters explain
        expect(lines.length).toBeLessThanOrEqual(SKILL_MAX_LINES);
    });

    test('the skill names only what exists (meta-test) — cites no symbol the entries do not publish, and no page that is not on disk', () => {
        // Given - the committed skill
        // Then - every import, every call and every chapter link resolves
        expect(skillFindings(SKILL, ROOT)).toStrictEqual({
            missingPages: [],
            unknownCalls: [],
            unknownImports: [],
        });
    });

    test('the skill names only what exists (meta-test) — names what a false page cites', () => {
        // Given - a skill beside the real one, citing a symbol and a page that do not exist
        const scratch = mkdtempSync(join(tmpdir(), 'skill-'));
        const page = join(scratch, 'SKILL.md');
        writeFileSync(
            page,
            [
                "import { fakeOf, specification } from '@jterrazz/test';",
                'Double the port with `fakeOf<T>()`, then scope with `within(…)`.',
                'Read [the page](./docs/guides/gone.md).',
            ].join('\n'),
        );

        // Then - each falsehood is named, and the true names pass
        expect(skillFindings(page, ROOT)).toStrictEqual({
            missingPages: ['./docs/guides/gone.md'],
            unknownCalls: ['fakeOf'],
            unknownImports: ['fakeOf from @jterrazz/test'],
        });
    });

    test('the skill asks the fork the Getting started page states (meta-test) — the same kinds, in the same order, each at the place the generated fork names', () => {
        // Given - the skill's hand-kept fork, and the one the Getting started page is generated from
        const answers = [...readFileSync(SKILL, 'utf8').matchAll(SKILL_FORK_LINE)].map((match) => ({
            kind: match.groups?.kind,
            path: match.groups?.path ?? '',
        }));

        // Then - an agent following the skill lands where the constitution says
        expect(answers.map((answer) => answer.kind)).toStrictEqual(FORK.map((row) => row.kind));
        const misplaced = answers.filter(
            (answer, index) =>
                !answer.path.startsWith(
                    /`(?<place>[^`]+)`/u.exec(FORK[index]?.livesAt ?? '')?.groups?.place ?? '\0',
                ),
        );
        expect(misplaced).toStrictEqual([]);
    });

    test('knowledge has one owner each — the skill is one page, the API is the types (meta-test) — the skills tree holds one SKILL.md per skill, and nothing beside it', () => {
        // Given - every file under skills/
        const files = readdirSync(resolve(ROOT, 'skills'), { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => join(entry.parentPath, entry.name).slice(ROOT.length + 1));

        // Then - no references/, no card, no generated projection of any kind
        expect(files.filter((file) => !/^skills\/[^/]+\/SKILL\.md$/u.test(file))).toStrictEqual([]);
    });

    test('knowledge has one owner each — the skill is one page, the API is the types (meta-test) — no generated API reference: no typedoc config, dependency or script', () => {
        // Given - the tree and the manifest
        const manifest = readFileSync(resolve(ROOT, 'package.json'), 'utf8');
        const configs = readdirSync(ROOT).filter((entry) => /^typedoc(?:\.|$)/u.test(entry));

        // Then - the API is the types, and nothing writes a second copy of them into the reference
        expect(configs).toStrictEqual([]);
        expect(manifest).not.toMatch(/typedoc/u);
    });
});
