import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

const EXPORT_LIST = /export\s+(?:type\s+)?\{(?<names>[^}]*)\}/gu;
const EXPORT_DECLARATION =
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|function|class|type|interface|enum)\s+(?<name>[A-Za-z_$][\w$]*)/gu;
const EXPORT_ALL = /export\s+\*\s+from\s+'(?<from>\.[^']+)'/gu;
const SAMPLE_IMPORT = /import\s+\{(?<names>[^}]*)\}\s+from\s+'(?<from>@jterrazz\/test[^']*)'/gu;
const PROSE_CALL = /`(?<name>_*[A-Za-z$][\w$]*)[(<.]/gu;
const PAGE_LINK = /\]\((?<target>[^)#]+\.md)(?:#[^)]*)?\)/gu;

function namesOf(list: string): string[] {
    return list
        .split(',')
        .map((entry) =>
            entry
                .replace(/^\s*type\s+/u, '')
                .split(/\s+as\s+/u)
                .at(-1)
                ?.trim(),
        )
        .filter((name): name is string => name !== undefined && name !== '');
}

function exportedNames(file: string): Set<string> {
    const text = readFileSync(file, 'utf8');
    const names = new Set<string>();
    for (const match of text.matchAll(EXPORT_LIST)) {
        for (const name of namesOf(match.groups?.names ?? '')) {
            names.add(name);
        }
    }
    for (const match of text.matchAll(EXPORT_DECLARATION)) {
        names.add(match.groups?.name ?? '');
    }
    for (const match of text.matchAll(EXPORT_ALL)) {
        const from = resolve(dirname(file), (match.groups?.from ?? '').replace(/\.js$/u, '.ts'));
        for (const name of exportedNames(from)) {
            names.add(name);
        }
    }
    return names;
}

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
