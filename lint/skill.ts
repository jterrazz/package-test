import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * What a hand-written skill may NAME. The skill owns what is decided before a
 * test is written; the types own the API and the chapters own the prose — so
 * what keeps the page honest is that it can only cite what exists: a symbol an
 * entry publishes, or vitest provides, and a chapter on disk.
 */

/** The cap: past it, the skill is restating a chapter. */
export const SKILL_MAX_LINES = 120;

/** What vitest itself provides a test. */
const VITEST = [
    'afterAll',
    'afterEach',
    'beforeAll',
    'beforeEach',
    'describe',
    'expect',
    'it',
    'test',
    'vi',
];

const EXPORT_LIST = /export\s+(?:type\s+)?\{(?<names>[^}]*)\}/gu;
const EXPORT_DECLARATION =
    /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|function|class|type|interface|enum)\s+(?<name>[A-Za-z_$][\w$]*)/gu;
const EXPORT_ALL = /export\s+\*\s+from\s+'(?<from>\.[^']+)'/gu;
const SAMPLE_IMPORT = /import\s+\{(?<names>[^}]*)\}\s+from\s+'(?<from>@jterrazz\/test[^']*)'/gu;
const PROSE_CALL = /`(?<name>[A-Za-z_$][\w$]*)[(<.]/gu;
const CHAPTER_LINK = /\]\((?<target>[^)#]+\.md)(?:#[^)]*)?\)/gu;

/** The names of one `{ a, type B, c as d }` list, as exported. */
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

/** Every name a module exports, following its `export * from` lines. */
export function exportedNames(file: string): Set<string> {
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

/** What a skill cites that does not exist — each list empty for an honest page. */
export type SkillFindings = {
    /** Chapter links that resolve to nothing, from the skill's own folder. */
    missingChapters: string[];
    /** Names a sample imports that its entry does not publish. */
    unknownImports: string[];
    /** Calls the prose writes that nothing publishes. */
    unknownCalls: string[];
};

/** Judge one skill against the entries of the package at `root`. */
export function skillFindings(skillPath: string, root: string): SkillFindings {
    const skill = readFileSync(skillPath, 'utf8');
    const published: Record<string, Set<string>> = {
        '@jterrazz/test': exportedNames(resolve(root, 'src/index.ts')),
        '@jterrazz/test/vitest': exportedNames(resolve(root, 'src/runner/index.ts')),
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
        missingChapters: [...skill.matchAll(CHAPTER_LINK)]
            .map((match) => match.groups?.target ?? '')
            .filter((target) => !existsSync(resolve(dirname(skillPath), target))),
        unknownCalls: [...skill.matchAll(PROSE_CALL)]
            .map((match) => match.groups?.name ?? '')
            .filter((name) => !known.has(name)),
        unknownImports,
    };
}
