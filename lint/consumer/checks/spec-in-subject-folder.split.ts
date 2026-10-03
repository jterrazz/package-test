import { blankComments, SETUP_FOLDER } from '@jterrazz/typescript/rules';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { pathFrom } from '../../kit/checker/repoint.js';
import { closingOf } from '../../kit/project/source-scan.js';
import {
    aspectOf,
    lineEnd,
    lineStart,
    openedSubjects,
    TEST_CALL,
    withLeadingComments,
} from '../../kit/project/spec-subjects.js';
import type { Span, SpecRead } from '../../kit/project/spec-subjects.js';
import { lowestCommonFolder, reservedFolderOf } from '../../kit/project/tree.js';
import {
    codeOnly,
    declarationsOf,
    importsOf,
    isRead,
    pruned,
    rebased,
    without,
} from './spec-in-subject-folder.prune.js';
import type { Declaration } from './spec-in-subject-folder.prune.js';

const DESCRIBE_CALL = /^describe(?:\.\w+(?:\([^()]*\))?)*\s*\(/gmu;

function describesOf(text: string): (Span & { holdsTests: boolean; open: number })[] {
    const blank = blankComments(text);
    return [...blank.matchAll(DESCRIBE_CALL)].map((found) => {
        const open = found.index + found[0].length - 1;
        const close = closingOf(blank, open);
        const body = blank.slice(open, close);
        TEST_CALL.lastIndex = 0;
        return {
            end: lineEnd(text, close),
            holdsTests: TEST_CALL.test(body),
            open: lineEnd(text, blank.indexOf('{', open)),
            start: withLeadingComments(text, found.index),
        };
    });
}

/** `one-describe-per-file`: a split would otherwise break the one-describe law on every file it writes. */
function oneDescribe(text: string, aspect: string): string {
    let current = text;
    for (const empty of describesOf(current)
        .filter((describe) => !describe.holdsTests)
        .toReversed()) {
        current = current.slice(0, empty.start) + current.slice(empty.end);
    }
    const describes = describesOf(current);
    const [first] = describes;
    if (first === undefined) {
        return current;
    }
    for (const later of describes.slice(1).toReversed()) {
        const closing = lineStart(current, later.end - 1);
        current =
            current.slice(0, later.start) +
            current.slice(later.open, closing) +
            current.slice(later.end);
    }
    if (describes.length > 1) {
        const firstClosing = lineStart(current, first.end - 1);
        const closing = current.slice(firstClosing, first.end);
        current = `${current.slice(0, firstClosing)}${current.slice(first.end).trimEnd()}\n${closing.trimEnd()}\n`;
    }
    return current.replace(
        /^describe\((?<quote>['"`])(?:[^\\]|\\.)*?\k<quote>/mu,
        `describe('${aspect}'`,
    );
}

export type Draft = { target: string; text: string };

const BUILDS_DISK = /(?<![\w$])(?<!(?<!\.\.)\.)(?:file|directory)\s*\(/u;

function reads(code: string, name: string): boolean {
    return new RegExp(
        String.raw`(?<![\w$])(?<!(?<!\.\.)\.)${name.replaceAll('$', String.raw`\$`)}(?![\w$])`,
        'u',
    ).test(codeOnly(code));
}

/** A declaration building a `file()` or `directory()` (`paths-named-in-the-test`), or reading one, stays copied where it is read; a type only tests read stays in each file. */
function movedDeclarations(spec: SpecRead, drafts: readonly Draft[]): Declaration[] {
    const declarations = declarationsOf(spec.text);
    const code = new Map(declarations.map((d) => [d.name, spec.text.slice(d.start, d.end)]));
    const readers = (name: string): number =>
        drafts.filter((draft) => declarationsOf(draft.text).some((d) => d.name === name)).length;
    const excluded = new Set(
        declarations
            .filter((d) => BUILDS_DISK.test(codeOnly(code.get(d.name) ?? '')))
            .map((d) => d.name),
    );
    const moved = new Set(
        declarations
            .filter((d) => !d.type && readers(d.name) > 1 && !excluded.has(d.name))
            .map((d) => d.name),
    );
    for (let changed = true; changed;) {
        changed = false;
        for (const name of moved) {
            const body = (code.get(name) ?? '').replace(
                new RegExp(String.raw`^[\s\S]*?\b${name.replaceAll('$', String.raw`\$`)}\b`, 'u'),
                '',
            );
            for (const other of declarations) {
                if (other.name === name || !reads(body, other.name)) {
                    continue;
                }
                if (excluded.has(other.name)) {
                    moved.delete(name);
                    excluded.add(name);
                    changed = true;
                    break;
                }
                if (!moved.has(other.name)) {
                    moved.add(other.name);
                    changed = true;
                }
            }
        }
    }
    return declarations.filter((d) => moved.has(d.name));
}

function exported(code: string): string {
    const head = /^(?:const|let|async\s|function|type\s|interface\s)/mu.exec(blankComments(code));
    return head === null ? code : `${code.slice(0, head.index)}export ${code.slice(head.index)}`;
}

function withImportLine(text: string, line: string): string {
    const last = importsOf(text).at(-1);
    return last === undefined
        ? `${line}\n${text}`
        : `${text.slice(0, last.end)}${line}\n${text.slice(last.end)}`;
}

/** A `type` marks each type among values, so no type becomes a runtime import. */
function importLine(read: readonly string[], types: ReadonlySet<string>, from: string): string {
    if (read.every((name) => types.has(name))) {
        return `import type { ${read.join(', ')} } from '${from}';`;
    }
    const names = read.map((name) => (types.has(name) ? `type ${name}` : name));
    return `import { ${names.join(', ')} } from '${from}';`;
}

/** A module already at `<folder>/_setup/<aspect>.ts` is the author's: the copies stay. */
function withSharedHelpers(
    specsRoot: string,
    spec: SpecRead,
    drafts: Draft[],
): { drafts: Draft[]; setup?: Draft } {
    const moved = movedDeclarations(spec, drafts);
    if (moved.length === 0) {
        return { drafts };
    }
    const names = new Set(moved.map((d) => d.name));
    const types = new Set(moved.filter((d) => d.type).map((d) => d.name));
    const holds = (draft: Draft): boolean =>
        declarationsOf(draft.text).some((d) => names.has(d.name));
    const folder =
        lowestCommonFolder(drafts.filter(holds).map((draft) => dirname(draft.target))) ??
        dirname(spec.file);
    const module = join(
        reservedFolderOf(specsRoot, folder, SETUP_FOLDER),
        `${aspectOf(spec.file)}.ts`,
    );
    if (existsSync(module)) {
        return { drafts };
    }
    const imports = importsOf(spec.text)
        .map((clause) => spec.text.slice(clause.start, clause.end))
        .join('');
    const body = moved.map((d) => exported(spec.text.slice(d.start, d.end))).join('\n');
    const setup = {
        target: module,
        text: pruned(rebased(`${imports}\n${body}`, dirname(spec.file), dirname(module))).replace(
            /^\n+/u,
            '',
        ),
    };
    return {
        drafts: drafts.map((draft) => {
            if (!holds(draft)) {
                return draft;
            }
            const kept = without(
                draft.text,
                declarationsOf(draft.text).filter((d) => names.has(d.name)),
            );
            const read = [...names].filter((name) => reads(kept, name)).toSorted();
            const specifier = pathFrom(dirname(draft.target), module).replace(/\.ts$/u, '.js');
            return {
                target: draft.target,
                text: pruned(withImportLine(kept, importLine(read, types, specifier))),
            };
        }),
        setup,
    };
}

const HOOK_CALL = /^[ \t]*(?:afterAll|afterEach|beforeAll|beforeEach)\s*\(/gmu;

const AMBIENT = new Set([
    'afterAll',
    'afterEach',
    'async',
    'await',
    'beforeAll',
    'beforeEach',
    'console',
    'const',
    'expect',
    'false',
    'let',
    'new',
    'null',
    'process',
    'Promise',
    'return',
    'this',
    'true',
    'undefined',
    'vi',
]);

function namesRead(code: string): Set<string> {
    const bare = codeOnly(code);
    return new Set(
        [...bare.matchAll(/(?<![\w$])(?<!(?<!\.\.)\.)[A-Za-z_$][\w$]*/gu)]
            .map((found) => found[0])
            .filter((name) => !AMBIENT.has(name)),
    );
}

/** A hook reading nothing but the runner's names is every test's, and stays. */
function withoutIdleHooks(text: string): string {
    const blank = blankComments(text);
    const hooks = [...blank.matchAll(HOOK_CALL)].map((found) => {
        const open = found.index + found[0].length - 1;
        return {
            end: lineEnd(text, closingOf(blank, open)),
            start: withLeadingComments(text, found.index),
        };
    });
    const idle = hooks.filter((hook) => {
        const names = [...namesRead(text.slice(hook.start, hook.end))];
        const rest = without(text, [hook, ...importsOf(text)]);
        const declared = declarationsOf(rest);
        return (
            names.length > 0 &&
            names.every((name) => {
                const own = declared.find((d) => d.name === name) ?? { end: 0, start: 0 };
                return !isRead(rest, name, own);
            })
        );
    });
    return without(text, idle);
}

function splitDrafts(spec: SpecRead, plan: Map<string, string>): Draft[] {
    const [first = ''] = openedSubjects(spec);
    const neutral = new Set(spec.tests.filter((test) => test.subjects.length === 0));
    return [...plan].map(([name, target]) => {
        const kept = new Set(
            spec.tests.filter(
                (test) => test.subjects[0] === name || (name === first && neutral.has(test)),
            ),
        );
        const cut = without(
            spec.text,
            spec.tests.filter((test) => !kept.has(test)),
        );
        const text = oneDescribe(withoutIdleHooks(cut), aspectOf(target));
        return { target, text: pruned(rebased(text, dirname(spec.file), dirname(target))) };
    });
}

/** The files a split writes: one per subject, the one it opens on first, then the `_setup` module its shared helpers move to. */
export function splitFiles(specsRoot: string, spec: SpecRead, plan: Map<string, string>): Draft[] {
    const shared = withSharedHelpers(specsRoot, spec, splitDrafts(spec, plan));
    return shared.setup === undefined ? shared.drafts : [...shared.drafts, shared.setup];
}
