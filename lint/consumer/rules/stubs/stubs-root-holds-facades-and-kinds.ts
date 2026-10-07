import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    stringValue,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf, segmentsOf } from '../../../kit/project/linted-file.js';
import { isStubKind, STUB_KINDS } from '../../../kit/project/stub-kinds.js';
import { consumerRows } from '../../catalogue/manifest.js';
import {
    composes,
    compositionNames,
    exportsByName,
    exportsDefault,
    namesComposition,
} from './stubs-root-holds-facades-and-kinds.composition.js';

const KIND_FOLDERS = STUB_KINDS.map((kind) => `\`${kind}/\``).join(', ');

const COMPOSITE_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.stubs\.[cm]?ts$/u;
const UNIT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[cm]?ts$/u;
const REQUEST_DATA_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.request\.[cm]?ts$/u;

function isDefineStub(node: AstNode, namespaces: ReadonlySet<string>): boolean {
    const callee = child(node, 'callee');
    // Stryker disable next-line ConditionalExpression: a call always has a callee
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

function producesStub(declaration: AstNode | undefined, namespaces: ReadonlySet<string>): boolean {
    // Stryker disable next-line ConditionalExpression: a default export always declares something
    if (declaration === undefined) {
        return false;
    }
    return (
        isDefineStub(declaration, namespaces) ||
        declaration.type === 'ArrowFunctionExpression' ||
        declaration.type === 'FunctionDeclaration' ||
        declaration.type === 'FunctionExpression' ||
        // invariant: the value is built above; the `Stub` type covers what the AST cannot follow.
        declaration.type === 'Identifier'
    );
}

const ENTRY = /^@jterrazz\/test$|(?:^|\/)src\/index\.js$/u;

type EntryBindings = { builders: Map<string, string>; namespaces: Set<string> };

function entryBindings(program: AstNode): EntryBindings {
    const bindings: EntryBindings = { builders: new Map(), namespaces: new Set() };
    for (const statement of childList(program, 'body')) {
        if (
            // Stryker disable next-line ConditionalExpression: a re-export binds no name, and its specifiers import none
            statement.type !== 'ImportDeclaration' ||
            !ENTRY.test(stringValue(child(statement, 'source')) ?? '')
        ) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            const local = identifierName(child(specifier, 'local'));
            // Stryker disable next-line ConditionalExpression: an import's local name is always read
            if (specifier.type === 'ImportNamespaceSpecifier' && local !== undefined) {
                bindings.namespaces.add(local);
                continue;
            }
            const imported = child(specifier, 'imported');
            const kind = identifierName(imported) ?? stringValue(imported);
            // Stryker disable next-line ConditionalExpression,LogicalOperator: an import names what it imports and what it binds, and no undefined is a kind
            if (kind !== undefined && local !== undefined && isStubKind(kind)) {
                bindings.builders.set(local, kind);
            }
        }
    }
    return bindings;
}

function kindReached(node: AstNode, bindings: EntryBindings): string | undefined {
    // Stryker disable next-line ConditionalExpression,BlockStatement: a node that is no member has no object, and '' binds nothing
    if (node.type !== 'MemberExpression') {
        return undefined;
    }
    // Stryker disable next-line StringLiteral: a name no import binds reads as none
    const object = identifierName(child(node, 'object')) ?? '';
    const named = bindings.builders.get(object);
    if (named !== undefined) {
        return named;
    }
    const property = memberPropertyName(node);
    // Stryker disable next-line ConditionalExpression: no undefined is a kind
    return bindings.namespaces.has(object) && property !== undefined && isStubKind(property)
        ? property
        : undefined;
}

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
                // invariant: a composition re-export is a legitimate way to build the world.
                composed = stringValue(child(node, 'source')) !== undefined || composed;
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

function checkUnit(context: Context, program: AstNode, base: string, kind: string): void {
    if (REQUEST_DATA_FILE.test(base)) {
        return;
    }
    if (!UNIT_FILE.test(base)) {
        context.report({ data: { base }, messageId: 'badName', node: program });
        return;
    }
    let hasDefault = false;
    let wellFormed = false;
    const bindings = entryBindings(program);
    walk(program, (node) => {
        // Stryker disable next-line ConditionalExpression: only a named export lists a default
        const listsDefault = node.type === 'ExportNamedDeclaration' && exportsDefault(node);
        if (node.type === 'ExportDefaultDeclaration') {
            hasDefault = true;
            wellFormed =
                producesStub(child(node, 'declaration'), bindings.namespaces) || wellFormed;
        } else if (listsDefault) {
            hasDefault = true;
            wellFormed = true;
        }
        const used = kindReached(node, bindings);
        if (used !== undefined && used !== kind) {
            context.report({ data: { kind, used }, messageId: 'foreignBuilder', node });
        }
    });
    if (!hasDefault) {
        context.report({ data: { base }, messageId: 'missingDefault', node: program });
    } else if (!wellFormed) {
        context.report({ messageId: 'notDefineStub', node: program });
    }
}

type Check = (node: AstNode) => void;

function checkOf(context: Context): Check | undefined {
    const parts = segmentsOf(context);
    // invariant: `src/**/stubs/` is the framework's own stub module: only specs carry the convention.
    if (!identityOf(context).inSpecs) {
        return undefined;
    }
    const stubsIndex = parts.lastIndexOf('stubs');
    if (stubsIndex === -1) {
        return undefined;
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
        return isStubKind(kind)
            ? (node) => {
                  checkUnit(context, node, base, kind);
              }
            : (node) => {
                  context.report({
                      data: { entry: kind, kinds: KIND_FOLDERS },
                      messageId: 'badKindDir',
                      node,
                  });
              };
    }
    return (node) => {
        context.report({ data: { base }, messageId: 'tooDeep', node });
    };
}

const row = rowNamed(consumerRows, 'stubs-root-holds-facades-and-kinds');

/** The folder carries the kind, so a unit calling another kind's builder is an error. */
export const stubsRootHoldsFacadesAndKinds = defineRule(
    {
        docs: row,
        messages: {
            badKindDir: {
                found: '`__setup__/stubs/{{entry}}/` is no stub kind',
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
                found: 'a stub under `__setup__/stubs/{{kind}}/` calls the `{{used}}` builder',
                fix: 'move it to `__setup__/stubs/{{used}}/`, or build it with `{{kind}}.*` alone',
            },
            rootFile: {
                found: 'the stub unit "{{base}}" sits at the `__setup__/stubs/` root',
                fix: 'move it into the folder of its kind — one of {{kinds}}; the root holds only `*.stubs.ts` facades',
            },
            tooDeep: {
                found: 'the stub file "{{base}}" is nested below `__setup__/stubs/<kind>/`',
                fix: 'move it up into its kind folder',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let check: Check | undefined;
            return {
                before() {
                    check = checkOf(context);
                    // Stryker disable next-line ConditionalExpression: a file with no check runs a visitor that checks nothing
                    return check !== undefined;
                },
                Program(node: AstNode) {
                    // Stryker disable next-line OptionalChaining: `before` runs no visitor where it found no check
                    check?.(node);
                },
            };
        },
    },
);
