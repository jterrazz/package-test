import type { Context } from '@oxlint/plugins';

import {
    child,
    childList,
    findProperty,
    identifierName,
    segments,
    stringValue,
} from '../../ast.js';
import { lessonsAt } from '../../lesson.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';
import { SELF_CHAPTER, SELF_RULE_DOCS, selfRowOf } from '../../self-manifest.js';

/** What a facet's folder file is: its composition, its constructor, or neither. */
type FacetFile = 'composition' | 'constructor' | undefined;

/** `src/facets/<facet>/<facet>.facet.ts` is the composition, `<facet>.handle.ts` its constructor. */
function facetFileOf(filename: string): FacetFile {
    const [file = '', facet = '', facets = '', src = ''] = segments(filename).toReversed();
    if (src !== 'src' || facets !== 'facets') {
        return undefined;
    }
    if (file === `${facet}.facet.ts`) {
        return 'composition';
    }
    return file === `${facet}.handle.ts` ? 'constructor' : undefined;
}

/** The expression under the `as const` and `satisfies` it is written with. */
function unwrapped(node: AstNode | undefined): AstNode | undefined {
    return node?.type === 'TSAsExpression' ||
        node?.type === 'TSSatisfiesExpression' ||
        node?.type === 'ParenthesizedExpression'
        ? unwrapped(child(node, 'expression'))
        : node;
}

/** The one declarator of a `const` statement, or `undefined` for any other statement. */
function constDeclarator(statement: AstNode | undefined): AstNode | undefined {
    const declarators = childList(statement, 'declarations');
    return statement?.type === 'VariableDeclaration' &&
        statement.kind === 'const' &&
        declarators.length === 1
        ? declarators[0]
        : undefined;
}

/** `const composition = { … }`, written with `as const` or a `satisfies`. */
function isComposition(statement: AstNode): boolean {
    const declarator = constDeclarator(statement);
    return (
        identifierName(child(declarator, 'id')) === 'composition' &&
        unwrapped(child(declarator, 'init'))?.type === 'ObjectExpression'
    );
}

/** The object `defineFacet<…>()({ … })` is handed, when the statement exports one. */
function definedFacet(statement: AstNode): AstNode | undefined {
    const init = child(constDeclarator(child(statement, 'declaration')), 'init');
    const inner = child(init, 'callee');
    const [facet] = childList(init, 'arguments');
    return init?.type === 'CallExpression' &&
        inner?.type === 'CallExpression' &&
        identifierName(child(inner, 'callee')) === 'defineFacet' &&
        facet?.type === 'ObjectExpression'
        ? facet
        : undefined;
}

/** Is the statement an interface — the chain type the facet names? */
function isChainType(statement: AstNode): boolean {
    const declared =
        statement.type === 'ExportNamedDeclaration' ? child(statement, 'declaration') : statement;
    return declared?.type === 'TSInterfaceDeclaration';
}

/** `engines: (config) => ({ … })` — an arrow handing back the object of the adapters. */
function wiresAdapters(facet: AstNode): boolean {
    const engines = child(findProperty(facet, 'engines'), 'value');
    return (
        engines?.type === 'ArrowFunctionExpression' &&
        unwrapped(child(engines, 'body'))?.type === 'ObjectExpression'
    );
}

/** What a statement a composition cannot hold is, as a finding names it. */
function strayOf(statement: AstNode): string {
    const declared =
        statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
            ? (child(statement, 'declaration') ?? statement)
            : statement;
    return declared.type
        .replaceAll(/(?<lower>[a-z])(?<upper>[A-Z])/gu, '$<lower> $<upper>')
        .toLowerCase();
}

/** The layer an import source names inside `src/`, when it is one a definition or a result lives in. */
function layerOf(source: string): 'definition' | 'result' | undefined {
    if (/(?:^|\/)(?:capabilities|actions)\//u.test(source)) {
        return 'definition';
    }
    return /(?:^|\/)results\//u.test(source) ? 'result' : undefined;
}

/** Report every statement of a facet file that is not its composition, and engines that are not adapters. */
function judgeComposition(context: Context, program: AstNode): void {
    for (const statement of childList(program, 'body')) {
        const facet = definedFacet(statement);
        if (facet !== undefined && !wiresAdapters(facet)) {
            context.report({ messageId: 'engines', node: statement });
        } else if (
            facet === undefined &&
            statement.type !== 'ImportDeclaration' &&
            !isComposition(statement) &&
            !isChainType(statement)
        ) {
            context.report({
                data: { stray: strayOf(statement) },
                messageId: 'stray',
                node: statement,
            });
        }
    }
}

/** A definition's own steps — what the chain runs, never its constructor. */
const STEPS = new Set(['arm', 'perform', 'reduce']);

/**
 * CONVENTIONS I6 — a facet file is a composition, and its constructor opens it.
 *
 * `src/facets/<facet>/<facet>.facet.ts` holds its imports, the `composition`,
 * the chain interface computed from it and the `defineFacet(…)` that wires
 * its engines; `<facet>.handle.ts` never runs a definition's step nor builds
 * a result. A `self` rule: these folders are this package's architecture.
 */
export const i6FacetIsComposition: LintRule = {
    createOnce(context: Context): Visitor {
        let file: FacetFile;
        const imported = new Map<string, 'definition' | 'result'>();
        return {
            before: () => {
                file = facetFileOf(context.filename);
                imported.clear();
                return file !== undefined;
            },
            CallExpression: (node) => {
                const callee = child(node, 'callee');
                const owner = identifierName(child(callee, 'object'));
                const step = identifierName(child(callee, 'property'));
                if (
                    file === 'constructor' &&
                    callee?.type === 'MemberExpression' &&
                    owner !== undefined &&
                    step !== undefined &&
                    imported.get(owner) === 'definition' &&
                    STEPS.has(step)
                ) {
                    context.report({ data: { owner, step }, messageId: 'runsStep', node });
                }
            },
            ImportDeclaration: (node) => {
                const layer = layerOf(stringValue(child(node, 'source')) ?? '');
                for (const specifier of childList(node, 'specifiers')) {
                    const local = identifierName(child(specifier, 'local'));
                    if (layer !== undefined && local !== undefined) {
                        imported.set(local, layer);
                    }
                }
            },
            NewExpression: (node) => {
                const built = identifierName(child(node, 'callee'));
                if (
                    file === 'constructor' &&
                    built !== undefined &&
                    imported.get(built) === 'result'
                ) {
                    context.report({ data: { built }, messageId: 'buildsResult', node });
                }
            },
            Program: (node) => {
                if (file === 'composition') {
                    judgeComposition(context, node);
                }
            },
        };
    },
    meta: {
        docs: SELF_RULE_DOCS['i6-facet-is-composition'],
        messages: lessonsAt(
            selfRowOf('i6-facet-is-composition'),
            {
                buildsResult: {
                    found: 'the constructor builds a `{{built}}`, a result',
                    fix: 'let the action the chain ends on construct what it hands back; the constructor opens the facet (`<facet>Facet.open(config)`)',
                },
                engines: {
                    found: "the facet's `engines` is not an arrow handing back the object of its adapters",
                    fix: 'write `engines: (config) => ({ <port>: <adapter>, … })`; what builds an adapter is its seam',
                },
                runsStep: {
                    found: 'the constructor calls `{{owner}}.{{step}}()`, a step of a definition',
                    fix: 'open the facet (`<facet>Facet.open(config)`) and let the chain run the definitions it composes',
                },
                stray: {
                    found: 'a {{stray}} in a facet file, which holds its composition alone',
                    fix: 'move the logic to the capability, the action or the seam that owns it; a facet file lists definitions and wires engines',
                },
            },
            SELF_CHAPTER,
        ),
        type: 'problem',
    },
};
