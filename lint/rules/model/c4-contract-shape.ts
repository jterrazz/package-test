import type { Context } from '@oxlint/plugins';
import { dirname, join } from 'node:path';

import {
    child,
    childList,
    findProperty,
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

/** The only directories a `contracts/` root may hold — the provider carriers. */
const PROVIDERS = new Set(['anthropic', 'http', 'openai']);

/** The three suffixes that declare tests — `.test.ts(x)` and `.spec.ts`. */
const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;
/** A file oxlint itself visits — the AST half of the rule reports on those. */
const SOURCE_FILE = /\.[cm]?[jt]sx?$/u;
/** The public facade of a feature: `contracts/<kebab>.contracts.ts`. */
const COMPOSITE_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.contracts\.[cm]?ts$/u;
/** An internal unit contract: `contracts/<provider>/<kebab>.ts`. */
const UNIT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[cm]?ts$/u;
/** Matched data next to its contract: `contracts/<provider>/<stem>.request.ts`. */
const REQUEST_DATA_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.request\.[cm]?ts$/u;
/** Served data next to its contract: `contracts/<provider>/<stem>[.<qualifier>].response.json`. */
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

/** Is this node a `defineContract(...)` call? */
function isDefineContract(node: AstNode): boolean {
    const callee = node.callee as AstNode | undefined;
    return (
        node.type === 'CallExpression' &&
        callee?.type === 'Identifier' &&
        callee.name === 'defineContract'
    );
}

/** A default export that may legitimately produce a contract (value or factory). */
function producesContract(declaration: AstNode | undefined): boolean {
    if (declaration === undefined) {
        return false;
    }
    return (
        isDefineContract(declaration) ||
        declaration.type === 'ArrowFunctionExpression' ||
        declaration.type === 'FunctionDeclaration' ||
        declaration.type === 'FunctionExpression' ||
        // `export default newsroomArticle` — the value is built above; the type
        // Channel (Contract) covers what the AST cannot follow here.
        declaration.type === 'Identifier'
    );
}

/**
 * The provider a `request:` value implies, when the builder is written as
 * `<provider>.<verb>(…)` — the only statically decidable form.
 */
function requestProvider(request: AstNode | undefined): string | undefined {
    if (request?.type !== 'CallExpression') {
        return undefined;
    }
    const callee = request.callee as AstNode | undefined;
    if (callee?.type !== 'MemberExpression') {
        return undefined;
    }
    const object = callee.object as AstNode | undefined;
    return object?.type === 'Identifier' ? (object.name as string) : undefined;
}

/**
 * The layout half — walks the feature's `contracts/` tree from the test file
 * that owns it. Covers what oxlint never visits: a stray `.json` at the root,
 * a directory that is not a provider, a nested folder or a foreign extension
 * inside a provider folder.
 */
function checkLayout(context: Context, node: AstNode, contractsDir: string): void {
    const entries = listDirectory(contractsDir);
    if (entries === null) {
        return;
    }
    for (const entry of entries) {
        const path = join(contractsDir, entry);
        if (!isDirectory(path)) {
            // Source files at the root are reported on themselves (AST half).
            if (!SOURCE_FILE.test(entry)) {
                context.report({ data: { entry }, messageId: 'rootEntry', node });
            }
            continue;
        }
        if (!PROVIDERS.has(entry)) {
            context.report({ data: { entry }, messageId: 'badProviderDir', node });
            continue;
        }
        for (const inner of listDirectory(path) ?? []) {
            if (isDirectory(join(path, inner))) {
                context.report({
                    data: { child: inner, provider: entry },
                    messageId: 'providerSubfolder',
                    node,
                });
            } else if (!/\.[cm]?ts$/u.test(inner) && !inner.endsWith('.response.json')) {
                context.report({
                    data: { child: inner, provider: entry },
                    messageId: 'providerEntry',
                    node,
                });
            }
        }
    }
}

/** A module that is a facade — `./<name>.contracts`, with or without its extension. */
const FACADE_SOURCE = /\.contracts(?:\.[cm]?[jt]s)?$/u;

/** The type `defineContracts(...)` returns — a builder declared to return it composes. */
const COMPOSITION_TYPE = 'Contracts';

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
 * `defineContracts` itself: the bindings imported from a sibling facade (its
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

/** Is this a call that composes a world — `defineContracts(…)`, or a `.with(…)` on one? */
function composes(node: AstNode): boolean {
    if (node.type !== 'CallExpression') {
        return false;
    }
    const callee = child(node, 'callee');
    return (
        (callee?.type === 'Identifier' && callee.name === 'defineContracts') ||
        (callee !== undefined && memberPropertyName(callee) === 'with')
    );
}

/**
 * The facade: `<kebab>.contracts.ts`, exporting its builders and sets by
 * name — and, when it has a default export, a composition there.
 */
function checkComposite(context: Context, program: AstNode, base: string): void {
    if (!COMPOSITE_FILE.test(base)) {
        context.report({ data: { base }, messageId: 'rootFile', node: program });
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
                // `export { default } from './other.contracts.js'` — a
                // Composition re-export is a legitimate way to build the world.
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
        context.report({ data: { base }, messageId: 'notDefineContracts', node: program });
    }
}

/** A unit contract under its provider folder. */
function checkUnit(context: Context, program: AstNode, base: string, provider: string): void {
    if (REQUEST_DATA_FILE.test(base)) {
        return; // Matched data (a prompt, an expected body) — it exports a value.
    }
    if (!UNIT_FILE.test(base)) {
        context.report({ data: { base }, messageId: 'badName', node: program });
        return;
    }
    let hasDefault = false;
    let wellFormed = false;
    walk(program, (node) => {
        if (node.type === 'ExportDefaultDeclaration') {
            hasDefault = true;
            wellFormed = producesContract(node.declaration as AstNode | undefined) || wellFormed;
        } else if (node.type === 'ExportNamedDeclaration' && exportsDefault(node)) {
            hasDefault = true;
            wellFormed = true; // `export { contract as default }` — built above.
        }
        if (isDefineContract(node)) {
            const argument = (node.arguments as AstNode[] | undefined)?.[0];
            const request =
                argument === undefined
                    ? undefined
                    : (findProperty(argument, 'request')?.value as AstNode | undefined);
            const declared = requestProvider(request);
            if (declared !== undefined && PROVIDERS.has(declared) && declared !== provider) {
                context.report({
                    data: { declared, provider },
                    messageId: 'providerMismatch',
                    node,
                });
            }
        }
    });
    if (!hasDefault) {
        context.report({ data: { base }, messageId: 'missingDefault', node: program });
    } else if (!wellFormed) {
        context.report({ data: { base }, messageId: 'notDefineContract', node: program });
    }
}

/** What C4 checks of a file's program. */
type Check = (node: AstNode) => void;

/** What C4 checks of the file being linted, by where it sits — nothing out of every contract tree. */
function checkOf(context: Context): Check | undefined {
    const file = context.physicalFilename;
    const parts = segmentsOf(context);
    // `src/**/contracts/` is the framework's own contract MODULE, not a
    // Feature's contract tree — only specs carry the convention.
    if (!identityOf(context).inSpecs) {
        return undefined;
    }
    const contractsIndex = parts.lastIndexOf('contracts');
    if (contractsIndex === -1) {
        return TEST_FILE.test(file)
            ? (node) => {
                  checkLayout(context, node, join(dirname(file), 'contracts'));
              }
            : undefined;
    }
    const base = parts.at(-1) ?? '';
    const depth = parts.length - 1 - contractsIndex;
    if (depth === 1) {
        return (node) => {
            checkComposite(context, node, base);
        };
    }
    if (depth === 2) {
        const provider = parts[contractsIndex + 1] ?? '';
        // A non-provider directory is reported once, by the layout half.
        return PROVIDERS.has(provider)
            ? (node) => {
                  checkUnit(context, node, base, provider);
              }
            : undefined;
    }
    return (node) => {
        context.report({ data: { base }, messageId: 'tooDeep', node });
    };
}

/**
 * CONVENTIONS C4 — the structure of a feature's `contracts/` tree. The ROOT
 * holds only `*.contracts.ts` facades (their builders and sets exported by
 * name; a default export, when there is one, a `defineContracts`
 * composition) and the provider
 * directories `http` / `openai` / `anthropic`. A provider directory holds
 * `<kebab>.ts` unit contracts (default export = `defineContract(...)` or a
 * factory returning one) plus their sibling data (`*.response.json`,
 * `*.request.ts`) — the FOLDER carries the provider, so a unit whose `request`
 * builder names another provider is an error.
 *
 * Two halves: the AST half reports on each contract file it visits, the layout
 * half walks the tree from the feature's test file (oxlint never visits a
 * `.json` fixture or an empty directory).
 */
export const c4ContractShape: LintRule = {
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
        docs: RULE_DOCS['c4-contract-shape'],
        messages: lessons('c4-contract-shape', {
            badName: {
                found: 'the contract unit "{{base}}" is not named `<kebab-name>.ts`',
                fix: 'rename it in kebab-case, without the provider — the folder carries it',
            },
            badProviderDir: {
                found: '`contracts/{{entry}}/` is no provider folder',
                fix: 'move its units into `http/`, `openai/` or `anthropic/`',
            },
            exportsNothing: {
                found: 'the contract facade "{{base}}" exports nothing',
                fix: 'export its builders and sets by name',
            },
            missingDefault: {
                found: 'the contract unit "{{base}}" has no default export',
                fix: 'default-export `defineContract(…)`, or a factory returning one',
            },
            notDefineContract: {
                found: "a contract unit's default export is not a contract",
                fix: 'default-export `defineContract(…)`, or a factory returning one',
            },
            notDefineContracts: {
                found: 'the default export of "{{base}}" is not built from contracts',
                fix: 'build it from `defineContracts(…)`, a composition re-export, a scenario of a sibling facade, or a builder declared to return `Contracts`',
            },
            providerEntry: {
                found: '`contracts/{{provider}}/{{child}}` is neither a `*.ts` contract nor a `*.response.json` payload',
                fix: 'make it one of the two, or move it out of `contracts/`',
            },
            providerMismatch: {
                found: 'a contract under `contracts/{{provider}}/` whose request is a `{{declared}}.*` builder',
                fix: 'move it to `contracts/{{declared}}/`',
            },
            providerSubfolder: {
                found: '`contracts/{{provider}}/{{child}}/` nests a folder in a provider folder',
                fix: 'move its files up into `contracts/{{provider}}/`',
            },
            rootEntry: {
                found: '`contracts/{{entry}}` at the contracts root',
                fix: 'move it into the provider folder of the contract it pairs with',
            },
            rootFile: {
                found: 'the contract unit "{{base}}" sits at the `contracts/` root',
                fix: 'move it into `http/`, `openai/` or `anthropic/`; the root holds only `*.contracts.ts` facades',
            },
            tooDeep: {
                found: 'the contract file "{{base}}" is nested below `contracts/<provider>/`',
                fix: 'move it up into its provider folder',
            },
        }),
        type: 'problem',
    },
};
