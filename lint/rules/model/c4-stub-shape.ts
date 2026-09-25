import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import { isStubKind, STUB_KINDS } from '../../../src/world/stubs/kinds.js';
import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    stringValue,
    walk,
} from '../../ast.js';
import { isDirectory, listDirectory } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { identityOf, segmentsOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The kind folders a `stubs/` root may hold, as a message names them. */
const KIND_FOLDERS = STUB_KINDS.map((kind) => `\`${kind}/\``).join(', ');

/** The three suffixes that declare tests — `.test.ts(x)` and `.spec.ts`. */
const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;
/** A file oxlint itself visits — the AST half of the rule reports on those. */
const SOURCE_FILE = /\.[cm]?[jt]sx?$/u;
/** The public facade of a feature: `stubs/<kebab>.stubs.ts`. */
const COMPOSITE_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.stubs\.[cm]?ts$/u;
/** An internal unit stub: `stubs/<kind>/<kebab>.ts`. */
const UNIT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[cm]?ts$/u;
/** Matched data next to its stub: `stubs/<kind>/<stem>.request.ts`. */
const REQUEST_DATA_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.request\.[cm]?ts$/u;
/** Served data next to its stub: `stubs/<kind>/<stem>[.<qualifier>].response.json`. */
const RESPONSE_DATA_FILE = /\.response\.json$/u;

/** The name a specifier/declaration exports under, when it is `default`. */
function exportsDefault(node: AstNode): boolean {
    const specifiers = (node.specifiers as AstNode[] | undefined) ?? [];
    return specifiers.some((specifier) => {
        const exported = specifier.exported as AstNode | undefined;
        return (
            (exported?.type === 'Identifier' && exported.name === 'default') ||
            stringValue(exported) === 'default'
        );
    });
}

/** Is this node a `defineStub(...)` call — bare, or on a namespace the entry is bound to? */
function isDefineStub(node: AstNode, namespaces: ReadonlySet<string>): boolean {
    const callee = child(node, 'callee');
    if (node.type !== 'CallExpression' || callee === undefined) {
        return false;
    }
    if (callee.type === 'Identifier') {
        return callee.name === 'defineStub';
    }
    return (
        memberPropertyName(callee) === 'defineStub' &&
        namespaces.has(identifierName(child(callee, 'object')) ?? '')
    );
}

/** A default export that may legitimately produce a stub (value or factory). */
function producesStub(declaration: AstNode | undefined, namespaces: ReadonlySet<string>): boolean {
    if (declaration === undefined) {
        return false;
    }
    return (
        isDefineStub(declaration, namespaces) ||
        declaration.type === 'ArrowFunctionExpression' ||
        declaration.type === 'FunctionDeclaration' ||
        declaration.type === 'FunctionExpression' ||
        // `export default newsroomArticle` — the value is built above; the type
        // channel (Stub) covers what the AST cannot follow here.
        declaration.type === 'Identifier'
    );
}

/** The package's own entry — published, or a repository's source. */
const ENTRY = /^@jterrazz\/test$|(?:^|\/)src\/index\.js$/u;

/** What a file binds from the entry: each stub builder's local name → its kind, and the namespaces. */
type EntryBindings = { builders: Map<string, string>; namespaces: Set<string> };

/** The local names the file binds from the entry — named builders, and `import * as` namespaces. */
function entryBindings(program: AstNode): EntryBindings {
    const bindings: EntryBindings = { builders: new Map(), namespaces: new Set() };
    for (const statement of childList(program, 'body')) {
        if (
            statement.type !== 'ImportDeclaration' ||
            !ENTRY.test(stringValue(child(statement, 'source')) ?? '')
        ) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            const local = identifierName(child(specifier, 'local'));
            if (specifier.type === 'ImportNamespaceSpecifier' && local !== undefined) {
                bindings.namespaces.add(local);
                continue;
            }
            const imported = child(specifier, 'imported');
            const kind = identifierName(imported) ?? stringValue(imported);
            if (kind !== undefined && local !== undefined && isStubKind(kind)) {
                bindings.builders.set(local, kind);
            }
        }
    }
    return bindings;
}

/**
 * The stub kind a member expression reaches the builder of — `http.get` through
 * a named import, `t.http` through a namespace — or `undefined`.
 */
function kindReached(node: AstNode, bindings: EntryBindings): string | undefined {
    if (node.type !== 'MemberExpression') {
        return undefined;
    }
    const object = identifierName(child(node, 'object')) ?? '';
    const named = bindings.builders.get(object);
    if (named !== undefined) {
        return named;
    }
    const property = memberPropertyName(node);
    return bindings.namespaces.has(object) && property !== undefined && isStubKind(property)
        ? property
        : undefined;
}

/**
 * The layout half — walks the feature's `stubs/` tree from the test file
 * that owns it. Covers what oxlint never visits: a stray `.json` at the root,
 * a directory that is no stub kind, a nested folder or a foreign extension
 * inside a kind folder.
 */
function checkLayout(context: Context, node: AstNode, stubsDir: string): void {
    const entries = listDirectory(stubsDir);
    if (entries === null) {
        return;
    }
    for (const entry of entries) {
        const path = join(stubsDir, entry);
        if (!isDirectory(path)) {
            // Source files at the root are reported on themselves (AST half).
            if (!SOURCE_FILE.test(entry)) {
                context.report({ data: { entry }, messageId: 'rootEntry', node });
            }
            continue;
        }
        if (!isStubKind(entry)) {
            context.report({ data: { entry, kinds: KIND_FOLDERS }, messageId: 'badKindDir', node });
            continue;
        }
        for (const inner of listDirectory(path) ?? []) {
            if (isDirectory(join(path, inner))) {
                context.report({
                    data: { child: inner, kind: entry },
                    messageId: 'kindSubfolder',
                    node,
                });
            } else if (!/\.[cm]?ts$/u.test(inner) && !inner.endsWith('.response.json')) {
                context.report({
                    data: { child: inner, kind: entry },
                    messageId: 'kindEntry',
                    node,
                });
            }
        }
    }
}

/** A module that is a facade — `./<name>.stubs`, with or without its extension. */
const FACADE_SOURCE = /\.stubs(?:\.[cm]?[jt]s)?$/u;

/** The type `defineStubs(...)` returns — a builder declared to return it composes. */
const COMPOSITION_TYPE = 'Stubs';

/** Is this function declared to return the composition's own type? */
function returnsComposition(fn: AstNode | undefined): boolean {
    const annotation = child(child(fn, 'returnType'), 'typeAnnotation');
    return (
        annotation?.type === 'TSTypeReference' &&
        identifierName(child(annotation, 'typeName')) === COMPOSITION_TYPE
    );
}

/** The local names an import from a sibling facade binds — its scenarios. */
function facadeImports(node: AstNode): string[] {
    if (!FACADE_SOURCE.test(stringValue(child(node, 'source')) ?? '')) {
        return [];
    }
    return childList(node, 'specifiers').flatMap(
        (specifier) => identifierName(child(specifier, 'local')) ?? [],
    );
}

/** The name a builder declared to return the composition is bound to. */
function compositionBuilder(node: AstNode): string | undefined {
    if (node.type === 'FunctionDeclaration') {
        return returnsComposition(node) ? identifierName(child(node, 'id')) : undefined;
    }
    if (node.type === 'VariableDeclarator') {
        return returnsComposition(child(node, 'init'))
            ? identifierName(child(node, 'id'))
            : undefined;
    }
    return undefined;
}

/**
 * The names whose value is a composition without the file calling
 * `defineStubs` itself: the bindings imported from a sibling facade (its
 * named exports are scenarios, compositions by C4), and the builders this file
 * declares with the composition's return type.
 */
function compositionNames(node: AstNode, names: Set<string>): void {
    const found =
        node.type === 'ImportDeclaration' ? facadeImports(node) : [compositionBuilder(node)];
    for (const name of found) {
        if (name !== undefined) {
            names.add(name);
        }
    }
}

/** A default export whose value one of `names` produces — the name itself, or a call to it. */
function namesComposition(declaration: AstNode | undefined, names: ReadonlySet<string>): boolean {
    const value =
        declaration?.type === 'CallExpression' ? child(declaration, 'callee') : declaration;
    const name = identifierName(value);
    return name !== undefined && names.has(name);
}

/** Does this export declaration export a value by a name of its own — never `default`, never a type alone? */
function exportsByName(node: AstNode): boolean {
    if (node.exportKind === 'type') {
        return false;
    }
    if (node.type === 'ExportAllDeclaration') {
        return true;
    }
    return child(node, 'declaration') !== undefined || !exportsDefault(node);
}

/** Is this a call that composes a world — `defineStubs(…)`, or a `.with(…)` on one? */
function composes(node: AstNode): boolean {
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    return (
        (callee?.type === 'Identifier' && callee.name === 'defineStubs') ||
        (callee !== undefined && memberPropertyName(callee) === 'with')
    );
}

/**
 * The facade: `<kebab>.stubs.ts`, exporting its builders and sets by
 * name — and, when it has a default export, a composition there.
 */
function checkComposite(context: Context, program: AstNode, base: string): void {
    if (!COMPOSITE_FILE.test(base)) {
        context.report({
            data: { base, kinds: KIND_FOLDERS },
            messageId: 'rootFile',
            node: program,
        });
        return;
    }
    let named = false;
    let hasDefault = false;
    let composed = false;
    let declaration: AstNode | undefined;
    const names = new Set<string>();
    walk(program, (node) => {
        compositionNames(node, names);
        if (node.type === 'ExportDefaultDeclaration') {
            hasDefault = true;
            declaration = child(node, 'declaration');
        } else if (node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration') {
            named = exportsByName(node) || named;
            if (exportsDefault(node)) {
                hasDefault = true;
                // `export { default } from './other.stubs.js'` — a
                // composition re-export is a legitimate way to build the world.
                composed =
                    stringValue(node.source as AstNode | undefined) !== undefined || composed;
            }
        } else if (composes(node)) {
            composed = true;
        }
    });
    if (!hasDefault && !named) {
        context.report({ data: { base }, messageId: 'exportsNothing', node: program });
    } else if (hasDefault && !composed && !namesComposition(declaration, names)) {
        context.report({ data: { base }, messageId: 'notDefineStubs', node: program });
    }
}

/** A unit stub under its kind folder. */
function checkUnit(context: Context, program: AstNode, base: string, kind: string): void {
    if (REQUEST_DATA_FILE.test(base)) {
        return; // Matched data (a prompt, an expected body) — it exports a value.
    }
    if (!UNIT_FILE.test(base)) {
        context.report({ data: { base }, messageId: 'badName', node: program });
        return;
    }
    let hasDefault = false;
    let wellFormed = false;
    const bindings = entryBindings(program);
    walk(program, (node) => {
        if (node.type === 'ExportDefaultDeclaration') {
            hasDefault = true;
            wellFormed =
                producesStub(node.declaration as AstNode | undefined, bindings.namespaces) ||
                wellFormed;
        } else if (node.type === 'ExportNamedDeclaration' && exportsDefault(node)) {
            hasDefault = true;
            wellFormed = true; // `export { stub as default }` — built above.
        }
        const used = kindReached(node, bindings);
        if (used !== undefined && used !== kind) {
            context.report({ data: { kind, used }, messageId: 'foreignBuilder', node });
        }
    });
    if (!hasDefault) {
        context.report({ data: { base }, messageId: 'missingDefault', node: program });
    } else if (!wellFormed) {
        context.report({ data: { base }, messageId: 'notDefineStub', node: program });
    }
}

/** What C4 checks of a file's program. */
type Check = (node: AstNode) => void;

/** What C4 checks of the file being linted, by where it sits — nothing out of every stub tree. */
function checkOf(context: Context): Check | undefined {
    const file = context.physicalFilename;
    const parts = segmentsOf(context);
    // `src/**/stubs/` is the framework's own stub MODULE, not a
    // feature's stub tree — only specs carry the convention.
    if (!identityOf(context).inSpecs) {
        return undefined;
    }
    const stubsIndex = parts.lastIndexOf('stubs');
    if (stubsIndex === -1) {
        return TEST_FILE.test(file)
            ? (node) => {
                  checkLayout(context, node, join(dirname(file), 'stubs'));
              }
            : undefined;
    }
    const base = parts.at(-1) ?? '';
    const depth = parts.length - 1 - stubsIndex;
    if (depth === 1) {
        return (node) => {
            checkComposite(context, node, base);
        };
    }
    if (depth === 2) {
        const kind = parts[stubsIndex + 1] ?? '';
        // A folder that is no kind is reported once, by the layout half.
        return isStubKind(kind)
            ? (node) => {
                  checkUnit(context, node, base, kind);
              }
            : undefined;
    }
    return (node) => {
        context.report({ data: { base }, messageId: 'tooDeep', node });
    };
}

/**
 * CONVENTIONS C4 — the structure of a feature's `stubs/` tree. The ROOT
 * holds only `*.stubs.ts` facades (their builders and sets exported by
 * name; a default export, when there is one, a `defineStubs`
 * composition) and one folder per stub KIND — a builder the package exports
 * (`STUB_KINDS`). A kind folder holds `<kebab>.ts` unit stubs (default
 * export = `defineStub(...)` or a factory returning one) plus their sibling
 * data (`*.response.json`, `*.request.ts`) — the FOLDER carries the kind, so
 * a unit that calls another kind's builder is an error.
 *
 * Two halves: the AST half reports on each stub file it visits, the layout
 * half walks the tree from the feature's test file (oxlint never visits a
 * `.json` fixture or an empty directory).
 */
export const c4StubShape: LintRule = {
    createOnce(context: Context): Visitor {
        let check: Check | undefined;
        return {
            before() {
                check = checkOf(context);
                return check !== undefined;
            },
            Program(node: AstNode) {
                check?.(node);
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c4-stub-shape'],
        messages: lessons('c4-stub-shape', {
            badKindDir: {
                found: '`stubs/{{entry}}/` is no stub kind',
                fix: 'move its units into the folder of the builder they call — one of {{kinds}}',
            },
            badName: {
                found: 'the stub unit "{{base}}" is not named `<kebab-name>.ts`',
                fix: 'rename it in kebab-case, without the kind — the folder carries it',
            },
            exportsNothing: {
                found: 'the stub facade "{{base}}" exports nothing',
                fix: 'export its builders and sets by name',
            },
            missingDefault: {
                found: 'the stub unit "{{base}}" has no default export',
                fix: 'default-export `defineStub(…)`, or a factory returning one',
            },
            notDefineStub: {
                found: "a stub unit's default export is not a stub",
                fix: 'default-export `defineStub(…)`, or a factory returning one',
            },
            notDefineStubs: {
                found: 'the default export of "{{base}}" is not built from stubs',
                fix: 'build it from `defineStubs(…)`, a composition re-export, a scenario of a sibling facade, or a builder declared to return `Stubs`',
            },
            foreignBuilder: {
                found: 'a stub under `stubs/{{kind}}/` calls the `{{used}}` builder',
                fix: 'move it to `stubs/{{used}}/`, or build it with `{{kind}}.*` alone',
            },
            kindEntry: {
                found: '`stubs/{{kind}}/{{child}}` is neither a `*.ts` stub nor a `*.response.json` payload',
                fix: 'make it one of the two, or move it out of `stubs/`',
            },
            kindSubfolder: {
                found: '`stubs/{{kind}}/{{child}}/` nests a folder in a kind folder',
                fix: 'move its files up into `stubs/{{kind}}/`',
            },
            rootEntry: {
                found: '`stubs/{{entry}}` at the stubs root',
                fix: 'move it into the kind folder of the stub it pairs with',
            },
            rootFile: {
                found: 'the stub unit "{{base}}" sits at the `stubs/` root',
                fix: 'move it into the folder of its kind — one of {{kinds}}; the root holds only `*.stubs.ts` facades',
            },
            tooDeep: {
                found: 'the stub file "{{base}}" is nested below `stubs/<kind>/`',
                fix: 'move it up into its kind folder',
            },
        }),
        type: 'problem',
    },
};
