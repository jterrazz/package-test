import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

import {
    forgetTree,
    moveKeepingHistory,
    treeEntries,
    treeKind,
} from '../../src/kernel/files/git-tree.js';
import { GROUND_DIRS, SHARED_GROUND } from '../../src/kernel/files/ground.js';
import { closingOf, literalEnd, withoutComments } from '../reading/subject.js';
import { repointModuleTests } from './repoint.js';
import {
    aspectOf,
    lineEnd,
    lineStart,
    openedSubjects,
    shown,
    silenced,
    splitPlan,
    subjectSpecs,
    TEST_CALL,
    withLeadingComments,
} from './spec-subjects.js';
import type { Span, SpecRead } from './spec-subjects.js';
import { listFiles } from './tree.js';

type ImportClause = Span & {
    defaultName: string | undefined;
    named: { local: string; text: string }[];
    source: string;
    typeOnly: boolean;
};

const IMPORT =
    /^import\s+(?<type>type\s+)?(?:(?<plain>[\w$]+)\s*,?\s*)?(?:\{(?<named>[^}]*)\})?\s*from\s+(?<quote>['"])(?<source>[^'"]+)\k<quote>;?[ \t]*\n?/gmu;

function importsOf(text: string): ImportClause[] {
    return [...text.matchAll(IMPORT)].map((found) => ({
        defaultName: found.groups?.plain,
        end: found.index + found[0].length,
        named: (found.groups?.named ?? '')
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry !== '')
            .map((entry) => ({
                local: (entry.split(/\s+as\s+/u).at(-1) ?? entry).replace(/^type\s+/u, ''),
                text: entry,
            })),
        source: found.groups?.source ?? '',
        start: found.index,
        typeOnly: found.groups?.type !== undefined,
    }));
}

function importText(clause: ImportClause, keeps: (local: string) => boolean): string {
    const plain =
        clause.defaultName !== undefined && keeps(clause.defaultName)
            ? clause.defaultName
            : undefined;
    const named = clause.named.filter((name) => keeps(name.local)).map((name) => name.text);
    const parts = [plain, named.length === 0 ? undefined : `{ ${named.join(', ')} }`].filter(
        (part) => part !== undefined,
    );
    return parts.length === 0
        ? ''
        : `import ${clause.typeOnly ? 'type ' : ''}${parts.join(', ')} from '${clause.source}';\n`;
}

/** A name written in a message is no read of it; a template stays whole, since its holes hold code. */
function codeOnly(text: string): string {
    const blank = withoutComments(text);
    let out = '';
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            out += blank[index] ?? '';
            index += 1;
            continue;
        }
        const literal = blank.slice(index, end);
        out += literal.startsWith('`') ? literal : literal.replaceAll(/[^\n]/gu, ' ');
        index = end;
    }
    return out;
}

function isRead(text: string, name: string, declared: Span): boolean {
    const body = codeOnly(`${text.slice(0, declared.start)}\n${text.slice(declared.end)}`);
    return new RegExp(
        String.raw`(?<![\w$.])${name.replaceAll('$', String.raw`\$`)}(?![\w$])`,
        'u',
    ).test(body);
}

type Declaration = Span & { name: string; type: boolean };

const DECLARATION =
    /^(?:(?:const|let)\s+(?<variable>[\w$]+)|(?:async\s+)?function\s*\*?\s*(?<fn>[\w$]+)|type\s+(?<alias>[\w$]+)|interface\s+(?<shape>[\w$]+))/gmu;

function statementEnd(blank: string, start: number, isFunction: boolean): number {
    let index = start;
    while (index < blank.length) {
        const character = blank[index] ?? '';
        const past = literalEnd(blank, index);
        if (past !== index) {
            index = past;
            continue;
        }
        if (character === '(' || character === '[' || character === '{') {
            const close = closingOf(blank, index);
            // An object type in a return annotation is followed by more of the head.
            if (
                isFunction &&
                character === '{' &&
                /^[ \t]*(?:\n|$)/u.test(blank.slice(close + 1))
            ) {
                return close + 1;
            }
            index = close + 1;
            continue;
        }
        if (character === ';') {
            return index + 1;
        }
        index += 1;
    }
    return blank.length;
}

/** An export is read elsewhere, and kept. */
function declarationsOf(text: string): Declaration[] {
    const blank = withoutComments(text);
    return [...blank.matchAll(DECLARATION)].flatMap((match) => {
        const { alias, fn, shape, variable } = match.groups ?? {};
        const name = variable ?? fn ?? alias ?? shape;
        if (name === undefined) {
            return [];
        }
        const end = statementEnd(
            blank,
            match.index + match[0].length,
            fn !== undefined || shape !== undefined,
        );
        return [
            {
                end: lineEnd(text, end - 1),
                name,
                start: withLeadingComments(text, match.index),
                type: alias !== undefined || shape !== undefined,
            },
        ];
    });
}

function withoutAnUnreadDeclaration(text: string): string {
    const unread = declarationsOf(text).find(
        (declaration) => !isRead(text, declaration.name, declaration),
    );
    return unread === undefined ? text : text.slice(0, unread.start) + text.slice(unread.end);
}

function withImportsPruned(text: string): string {
    const clauses = importsOf(text);
    // A name another import clause spells (`{ cli as vitestCli }`) is no read of it.
    const code = clauses
        .toReversed()
        .reduce((rest, clause) => rest.slice(0, clause.start) + rest.slice(clause.end), text);
    let current = text;
    for (const clause of clauses.toReversed()) {
        const kept = importText(clause, (local) => isRead(code, local, { end: 0, start: 0 }));
        current = current.slice(0, clause.start) + kept + current.slice(clause.end);
    }
    return current;
}

function pruned(text: string): string {
    let current = text;
    for (let previous = ''; previous !== current;) {
        previous = current;
        current = withoutAnUnreadDeclaration(current);
    }
    return withImportsPruned(current)
        .replaceAll(/\n{3,}/gu, '\n\n')
        .replace(/(?:\n[ \t]*\/\/[^\n]*|\n[ \t]*)+$/u, '\n');
}

function relativePath(from: string, to: string): string {
    const path = relative(from, to).split(sep).join('/');
    return path.startsWith('.') ? path : `./${path}`;
}

const RELATIVE_LITERAL =
    /(?<lead>(?<![.\w])(?:file|directory)\(\s*|\bfrom\s+|\bimport\(\s*|import\.meta\.dirname,\s*)(?<quote>['"])(?<path>\.\.?\/[^'"]*)\k<quote>/gu;

function literalSpans(text: string): Span[] {
    const blank = withoutComments(text);
    const spans: Span[] = [];
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            index += 1;
        } else {
            spans.push({ end, start: index });
            index = end;
        }
    }
    return spans;
}

/** A path naming nothing, a negative spec's missing file, says the same from anywhere. */
function rebased(text: string, from: string, to: string): string {
    const strings = literalSpans(text);
    let out = '';
    let last = 0;
    for (const found of text.matchAll(RELATIVE_LITERAL)) {
        const { lead = '', path = '', quote = "'" } = found.groups ?? {};
        const target = resolve(from, path);
        const inText = strings.some((span) => found.index > span.start && found.index < span.end);
        const isModule = /^(?:from|import)\b/u.test(lead);
        if (inText || (!isModule && !existsSync(target))) {
            continue;
        }
        const next =
            relativePath(to, target) + (path.endsWith('/') && !path.endsWith('../') ? '/' : '');
        out += `${text.slice(last, found.index)}${lead}${quote}${next.replace(/\/\/$/u, '/')}${quote}`;
        last = found.index + found[0].length;
    }
    return out + text.slice(last);
}

const DESCRIBE_CALL = /^describe(?:\.\w+(?:\([^()]*\))?)*\s*\(/gmu;

function describesOf(text: string): (Span & { holdsTests: boolean; open: number })[] {
    const blank = withoutComments(text);
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

function without(text: string, spans: Span[]): string {
    let current = text;
    for (const span of spans.toSorted((a, b) => b.start - a.start)) {
        current = current.slice(0, span.start) + current.slice(span.end);
    }
    return current;
}

function diskReferences(specsRoot: string): { file: string; target: string }[] {
    return listFiles(specsRoot, (path) => /\.(?:spec|test)\.tsx?$/u.test(path)).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(RELATIVE_LITERAL)]
            .filter(
                (found) =>
                    found.groups?.lead?.includes('from') !== true &&
                    found.groups?.lead?.includes('import') !== true,
            )
            .map((found) => ({ file, target: resolve(dirname(file), found.groups?.path ?? '.') })),
    );
}

function isAtOrBelow(entry: string, path: string): boolean {
    return path === entry || path.startsWith(`${entry}${sep}`);
}

function liftGround(specsRoot: string, leaf: string): string[] {
    const lifted: string[] = [];
    const references = diskReferences(specsRoot);
    for (const role of GROUND_DIRS) {
        const folder = join(leaf, role);
        if (treeKind(folder) !== 'directory') {
            continue;
        }
        for (const entry of treeEntries(folder)) {
            const path = join(folder, entry.name);
            const readers = references.filter(({ target }) => isAtOrBelow(path, target));
            if (readers.every(({ file }) => dirname(file) === leaf)) {
                continue;
            }
            const destination = join(specsRoot, SHARED_GROUND, role, entry.name);
            // The pool holds that name: `no-reach-into-sibling-ground` keeps reporting the reach.
            if (existsSync(destination)) {
                continue;
            }
            mkdirSync(dirname(destination), { recursive: true });
            moveKeepingHistory(path, destination);
            repointModuleTests(specsRoot, [{ copy: path, target: destination }]);
            for (const file of new Set(readers.map((reader) => reader.file))) {
                const text = readFileSync(file, 'utf8');
                const next = text.replaceAll(
                    relativePath(dirname(file), path),
                    relativePath(dirname(file), destination),
                );
                if (next !== text) {
                    writeFileSync(file, next);
                }
            }
            lifted.push(`${shown(specsRoot, path)} → ${shown(specsRoot, destination)}`);
        }
        if (readdirSync(folder).length === 0) {
            rmSync(folder, { recursive: true });
        }
    }
    forgetTree();
    return lifted;
}

type Draft = { target: string; text: string };

const BUILDS_DISK = /(?<![\w$.])(?:file|directory)\s*\(/u;

function reads(code: string, name: string): boolean {
    return new RegExp(
        String.raw`(?<![\w$.])${name.replaceAll('$', String.raw`\$`)}(?![\w$])`,
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

function commonFolder(paths: readonly string[]): string {
    const [first = [], ...rest] = paths.map((path) => path.split(sep));
    let depth = first.length;
    for (const parts of rest) {
        depth = Math.min(depth, parts.length);
        while (depth > 0 && parts.slice(0, depth).join(sep) !== first.slice(0, depth).join(sep)) {
            depth -= 1;
        }
    }
    return first.slice(0, depth).join(sep);
}

function exported(code: string): string {
    const head = /^(?:const|let|async\s|function|type\s|interface\s)/mu.exec(withoutComments(code));
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

/** A module already at `<folder>/<folder>.fixtures.ts` is the author's: the copies stay. */
function withSharedHelpers(spec: SpecRead, drafts: Draft[]): { drafts: Draft[]; fixtures?: Draft } {
    const moved = movedDeclarations(spec, drafts);
    if (moved.length === 0) {
        return { drafts };
    }
    const names = new Set(moved.map((d) => d.name));
    const types = new Set(moved.filter((d) => d.type).map((d) => d.name));
    const holds = (draft: Draft): boolean =>
        declarationsOf(draft.text).some((d) => names.has(d.name));
    const folder = commonFolder(drafts.filter(holds).map((draft) => dirname(draft.target)));
    const module = join(folder, `${basename(folder)}.fixtures.ts`);
    if (existsSync(module)) {
        return { drafts };
    }
    const imports = importsOf(spec.text)
        .map((clause) => spec.text.slice(clause.start, clause.end))
        .join('');
    const body = moved.map((d) => exported(spec.text.slice(d.start, d.end))).join('\n');
    const fixtures = {
        target: module,
        text: pruned(rebased(`${imports}\n${body}`, dirname(spec.file), folder)).replace(
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
            const specifier = relativePath(dirname(draft.target), module).replace(/\.ts$/u, '.js');
            return {
                target: draft.target,
                text: pruned(withImportLine(kept, importLine(read, types, specifier))),
            };
        }),
        fixtures,
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
        [...bare.matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/gu)]
            .map((found) => found[0])
            .filter((name) => !AMBIENT.has(name)),
    );
}

/** A hook reading nothing but the runner's names is every test's, and stays. */
function withoutIdleHooks(text: string): string {
    const blank = withoutComments(text);
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

function writeSplit(
    specsRoot: string,
    spec: SpecRead,
    keepsFile: boolean,
    drafts: Draft[],
): string[] {
    const shared = withSharedHelpers(spec, drafts);
    const [opening] = shared.drafts;
    if (opening !== undefined && !keepsFile && opening.target !== spec.file) {
        mkdirSync(dirname(opening.target), { recursive: true });
        moveKeepingHistory(spec.file, opening.target);
    }
    const written = [...shared.drafts, ...(shared.fixtures === undefined ? [] : [shared.fixtures])];
    for (const { target, text } of written) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text);
    }
    return written
        .filter(({ target }) => target !== spec.file)
        .map(({ target }) => `${shown(specsRoot, spec.file)} → ${shown(specsRoot, target)}`);
}

/** A test reaching two subjects goes with the one its chain opens on; a file whose target is taken is left for its author. */
export function fixSubjects(specsRoot: string): string[] {
    const done: string[] = [];
    for (const spec of subjectSpecs(specsRoot)) {
        if (spec.subjects.size === 0 || silenced(spec)) {
            continue;
        }
        const plan = splitPlan(specsRoot, spec);
        const targets = [...plan.values()];
        if (targets.every((target) => target === spec.file)) {
            continue;
        }
        if (targets.some((target) => target !== spec.file && existsSync(target))) {
            continue;
        }
        done.push(
            ...writeSplit(specsRoot, spec, targets.includes(spec.file), splitDrafts(spec, plan)),
        );
        forgetTree();
        done.push(...liftGround(specsRoot, dirname(spec.file)));
        removeEmptied(specsRoot, dirname(spec.file));
    }
    return done;
}

function removeEmptied(specsRoot: string, folder: string): void {
    let current = folder;
    while (current !== specsRoot && current.startsWith(specsRoot) && existsSync(current)) {
        if (readdirSync(current).length > 0) {
            break;
        }
        rmSync(current, { recursive: true });
        current = dirname(current);
    }
    forgetTree();
}
