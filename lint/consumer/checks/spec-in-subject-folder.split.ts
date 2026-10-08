import { blankComments, SETUP_FOLDER } from '@jterrazz/typescript/rules';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { pathFrom } from '../../kit/checker/repoint.js';
import { closingOf } from '../../kit/project/source-scan.js';
import {
    aspectOf,
    lineEnd,
    openedSubjects,
    withLeadingComments,
} from '../../kit/project/spec-subjects.js';
import type { Span, SpecRead } from '../../kit/project/spec-subjects.js';
import { lowestCommonFolder, reservedFolderOf } from '../../kit/project/tree.js';
import { withoutEmptiedGroups, withoutLooseComments } from './spec-in-subject-folder.cut.js';
import {
    codeOnly,
    declarationsOf,
    importsOf,
    isRead,
    isReadIn,
    moduleExtensionOf,
    pruned,
    rebased,
    without,
} from './spec-in-subject-folder.prune.js';
import type { Declaration } from './spec-in-subject-folder.prune.js';

export type Draft = { target: string; text: string };

const BUILDS_DISK = /(?<![\w$])(?<!(?<!\.\.)\.)(?:file|directory)\s*\(/u;

// invariant: a declaration building a `file()` or `directory()` (`paths-named-in-the-test`), or reading one, stays copied where it is read; a type only tests read stays in each file.
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
            // Stryker disable next-line StringLiteral: a moved name always has its code
            const body = code.get(name) ?? '';
            for (const other of declarations) {
                if (!isReadIn(body, other.name)) {
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
                    // Stryker disable next-line BooleanLiteral: a name added mid-pass is still visited in that pass
                    changed = true;
                }
            }
        }
    }
    return declarations.filter((d) => moved.has(d.name));
}

function exported(code: string): string {
    // Stryker disable next-line Regex: a declaration's code opens on its keyword, its comments blanked
    const head = /^(?:const|let|async\s|function|type\s|interface\s)/mu.exec(blankComments(code));
    // Stryker disable next-line ConditionalExpression: a declaration always opens on its keyword
    return head === null ? code : `${code.slice(0, head.index)}export ${code.slice(head.index)}`;
}

function withImportLine(text: string, line: string): string {
    const last = importsOf(text).at(-1);
    // Stryker disable next-line ConditionalExpression,EqualityOperator: a split spec imports its runner, so each file it writes keeps an import clause
    return last === undefined
        ? `${line}\n${text}`
        : `${text.slice(0, last.end)}${line}\n${text.slice(last.end)}`;
}

// invariant: a `type` marks each type among values, so no type becomes a runtime import.
function importLine(read: readonly string[], types: ReadonlySet<string>, from: string): string {
    if (read.every((name) => types.has(name))) {
        return `import type { ${read.join(', ')} } from '${from}';`;
    }
    const names = read.map((name) => (types.has(name) ? `type ${name}` : name));
    return `import { ${names.join(', ')} } from '${from}';`;
}

// invariant: a module already at `<folder>/__setup__/<aspect>.ts` is the author's: the copies stay.
function withSharedHelpers(
    specsRoot: string,
    spec: SpecRead,
    drafts: Draft[],
): { drafts: Draft[]; setup?: Draft } {
    const moved = movedDeclarations(spec, drafts);
    if (moved.length === 0) {
        return { drafts };
    }
    const extension = moduleExtensionOf(spec.text);
    const names = new Set(moved.map((d) => d.name));
    const types = new Set(moved.filter((d) => d.type).map((d) => d.name));
    const holds = (draft: Draft): boolean =>
        declarationsOf(draft.text).some((d) => names.has(d.name));
    const folder =
        lowestCommonFolder(drafts.filter(holds).map((draft) => dirname(draft.target))) ??
        dirname(spec.file);
    const module = join(reservedFolderOf(folder, SETUP_FOLDER), `${aspectOf(spec.file)}.ts`);
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
            // Stryker disable next-line Regex: a setup body opens on one blank line at most
            /^\n+/u,
            '',
        ),
    };
    return {
        drafts: drafts.map((draft) => {
            // Stryker disable next-line ConditionalExpression,BlockStatement: a file holding no moved name reads none, and the empty import it would get is pruned
            if (!holds(draft)) {
                return draft;
            }
            const kept = without(
                draft.text,
                declarationsOf(draft.text).filter((d) => names.has(d.name)),
            );
            const read = [...names].filter((name) => isReadIn(kept, name)).toSorted();
            // Stryker disable next-line Regex: a setup module is named <aspect>.ts, with no .ts before its end
            const specifier = pathFrom(dirname(draft.target), module).replace(/\.ts$/u, extension);
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

/** Each hook call of a spec — `beforeAll`, `afterEach` and their kin — from its leading comments to the end of its line. */
export function hooksOf(text: string): Span[] {
    const blank = blankComments(text);
    return [...blank.matchAll(HOOK_CALL)].map((found) => {
        // Stryker disable next-line ArithmeticOperator: read from the arrow's own parentheses, the scan still closes on the hook's body
        const open = found.index + found[0].length - 1;
        return {
            end: lineEnd(text, closingOf(blank, open)),
            start: withLeadingComments(text, found.index),
        };
    });
}

function isReadBesides(text: string, name: string, spans: readonly Span[]): boolean {
    const rest = without(text, [...spans, ...importsOf(text)]);
    const own = declarationsOf(rest).find((d) => d.name === name);
    // Stryker disable next-line ConditionalExpression: a name read here is declared in the file, so its declaration is found
    return own !== undefined && isRead(rest, name, own);
}

// invariant: a hook is cut only when every name it reads is a declaration the draft no longer reads, one of them read by a test the cut removed; a hook reading an import, a global, or serving no test the cut removed is every test's, and stays.
function withoutIdleHooks(text: string, source: string): string {
    const declared = new Set(declarationsOf(text).map((d) => d.name));
    const sourceHooks = hooksOf(source);
    const idle = hooksOf(text).filter((hook) => {
        const names = [...namesRead(text.slice(hook.start, hook.end))];
        return (
            names.every((name) => declared.has(name) && !isReadBesides(text, name, [hook])) &&
            names.some((name) => isReadBesides(source, name, sourceHooks))
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
        const said = name === first ? cut : withoutLooseComments(cut);
        const text = withoutEmptiedGroups(withoutIdleHooks(said, spec.text));
        return { target, text: pruned(rebased(text, dirname(spec.file), dirname(target))) };
    });
}

/** The files a split writes: one per subject, the one it opens on first, then the `__setup__` module its shared helpers move to. */
export function splitFiles(specsRoot: string, spec: SpecRead, plan: Map<string, string>): Draft[] {
    const shared = withSharedHelpers(specsRoot, spec, splitDrafts(spec, plan));
    return shared.setup === undefined ? shared.drafts : [...shared.drafts, shared.setup];
}
