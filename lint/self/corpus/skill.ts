import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { exportedNames, namesOf } from '../../kit/project/exported-names.js';

/** Past it, the skill is restating a page. */
export const SKILL_MAX_LINES = 120;

// invariant: `toMatch` included: the golden rides on it.
const VITEST = [
    'afterAll',
    'afterEach',
    'beforeAll',
    'beforeEach',
    'describe',
    'expect',
    'it',
    'test',
    'toMatch',
    'vi',
];

const SAMPLE_IMPORT = /import\s+\{(?<names>[^}]*)\}\s+from\s+'(?<from>@jterrazz\/test[^']*)'/gu;
const PROSE_CALL = /`(?<name>_*[A-Za-z$][\w$]*)[(<.]/gu;
const PAGE_LINK = /\]\((?<target>[^)#]+\.md)(?:#[^)]*)?\)/gu;

export type SkillFindings = {
    missingPages: string[];
    unknownImports: string[];
    unknownCalls: string[];
};

/** The skill can only cite what exists: a symbol an entry publishes or vitest provides, and a page on disk. */
export function skillFindings(skillPath: string, root: string): SkillFindings {
    const skill = readFileSync(skillPath, 'utf8');
    const published: Record<string, Set<string>> = {
        '@jterrazz/test': exportedNames(resolve(root, 'src/index.ts')),
        '@jterrazz/test/services': exportedNames(resolve(root, 'src/index.services.ts')),
        '@jterrazz/test/stubs': exportedNames(resolve(root, 'src/index.stubs.ts')),
        '@jterrazz/test/vitest': exportedNames(resolve(root, 'src/index.vitest.ts')),
    };
    const known = new Set(VITEST);
    for (const names of Object.values(published)) {
        for (const name of names) {
            known.add(name);
        }
    }
    const unknownImports: string[] = [];
    for (const match of skill.matchAll(SAMPLE_IMPORT)) {
        const from = match.groups?.from ?? '';
        for (const name of namesOf(match.groups?.names ?? '')) {
            if (published[from]?.has(name) !== true) {
                unknownImports.push(`${name} from ${from}`);
            }
        }
    }
    return {
        missingPages: [...skill.matchAll(PAGE_LINK)]
            .map((match) => match.groups?.target ?? '')
            .filter((target) => !existsSync(resolve(dirname(skillPath), target))),
        unknownCalls: [...skill.matchAll(PROSE_CALL)]
            .map((match) => match.groups?.name ?? '')
            .filter((name) => !known.has(name)),
        unknownImports,
    };
}
