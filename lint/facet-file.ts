import {
    child,
    childList,
    findProperty,
    identifierName,
    propertyKeyName,
    stringValue,
} from './ast.js';
import { isAdapter, isNamedKey, isReference, isRow, rootOf, unwrapped } from './facet-values.js';
import type { AstNode } from './rule-shape.js';

/**
 * What a facet file — `src/facets/<facet>/<facet>.facet.ts` — writes that a
 * composition cannot hold, read off its program: a statement beside the
 * composition, or logic written inline in the composition or in the facet it
 * defines. The self rule I6 reports each finding as it is returned.
 */

/** One thing a facet file holds that it cannot, as the rule's message names it. */
export type FacetFinding = {
    readonly data?: Record<string, string>;
    readonly messageId:
        | 'adapter'
        | 'defined'
        | 'engines'
        | 'inline'
        | 'listed'
        | 'member'
        | 'option'
        | 'stray';
    readonly node: AstNode;
};

/** The layer an import source names inside `src/`, when it is one a definition, a facet or a result lives in. */
export function layerOf(source: string): 'definition' | 'facet' | 'result' | undefined {
    if (/(?:^|\/)(?:capabilities|actions)\//u.test(source)) {
        return 'definition';
    }
    if (source.endsWith('.facet.js')) {
        return 'facet';
    }
    return /(?:^|\/)results\//u.test(source) ? 'result' : undefined;
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

/** The object of `const composition = { … }`, written with `as const` or a `satisfies`. */
function compositionOf(statement: AstNode): AstNode | undefined {
    const declarator = constDeclarator(statement);
    const init = unwrapped(child(declarator, 'init'));
    return identifierName(child(declarator, 'id')) === 'composition' &&
        init?.type === 'ObjectExpression'
        ? init
        : undefined;
}

/** A `defineFacet<…>(…)({ … })`: what the definer is handed, and the facet object. */
type DefinedFacet = { readonly facet: AstNode; readonly handed: AstNode[] };

/** The `defineFacet<…>(…)({ … })` the statement exports, if it exports one. */
function definedFacet(statement: AstNode): DefinedFacet | undefined {
    const init = child(constDeclarator(child(statement, 'declaration')), 'init');
    const inner = child(init, 'callee');
    const [facet] = childList(init, 'arguments');
    return init?.type === 'CallExpression' &&
        inner?.type === 'CallExpression' &&
        identifierName(child(inner, 'callee')) === 'defineFacet' &&
        facet?.type === 'ObjectExpression'
        ? { facet, handed: childList(inner, 'arguments') }
        : undefined;
}

/** Is the statement an interface — the chain type the facet names? */
function isChainType(statement: AstNode): boolean {
    const declared =
        statement.type === 'ExportNamedDeclaration' ? child(statement, 'declaration') : statement;
    return declared?.type === 'TSInterfaceDeclaration';
}

/**
 * The object `engines: (config) => ({ … })` hands back, when it is written
 * so: an arrow whose every parameter is a bare name, typed or not.
 */
function adaptersOf(facet: AstNode): AstNode | undefined {
    const engines = child(findProperty(facet, 'engines'), 'value');
    const body = unwrapped(child(engines, 'body'));
    return engines?.type === 'ArrowFunctionExpression' &&
        childList(engines, 'params').every((parameter) => parameter.type === 'Identifier') &&
        body?.type === 'ObjectExpression'
        ? body
        : undefined;
}

/** A node's kind as a finding names it: `FunctionDeclaration` → `function declaration`. */
function kindOf(node: AstNode | undefined): string {
    return (node?.type ?? 'nothing')
        .replaceAll(/(?<lower>[a-z])(?<upper>[A-Z])/gu, '$<lower> $<upper>')
        .toLowerCase();
}

/** What a statement a composition cannot hold is, as a finding names it. */
function strayOf(statement: AstNode): string {
    return kindOf(
        statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
            ? (child(statement, 'declaration') ?? statement)
            : statement,
    );
}

/** Every name a program imports, with the source it is imported from. */
export function importsOf(program: AstNode): Map<string, string> {
    const sources = new Map<string, string>();
    for (const statement of childList(program, 'body')) {
        const source = stringValue(child(statement, 'source'));
        const specifiers =
            statement.type === 'ImportDeclaration' ? childList(statement, 'specifiers') : [];
        for (const specifier of specifiers) {
            const local = identifierName(child(specifier, 'local'));
            if (source !== undefined && local !== undefined) {
                sources.set(local, source);
            }
        }
    }
    return sources;
}

/** What a `capabilities` or `actions` list holds that is no definition imported by name. */
function unlisted(member: AstNode, imports: ReadonlyMap<string, string>): FacetFinding[] {
    const key = propertyKeyName(member) ?? '…';
    const value = unwrapped(child(member, 'value'));
    const listed = value?.type === 'ArrayExpression' ? childList(value, 'elements') : [member];
    return listed
        .filter((element) => {
            const name = identifierName(element);
            return name === undefined || layerOf(imports.get(name) ?? '') !== 'definition';
        })
        .map((element) => ({
            data: { key, what: kindOf(element) },
            messageId: 'listed',
            node: element,
        }));
}

/** The options that are not a matrix row written as string literals. */
function unrowed(member: AstNode): FacetFinding[] {
    const value = unwrapped(child(member, 'value'));
    const options = value?.type === 'ObjectExpression' ? childList(value, 'properties') : [member];
    return options
        .filter(
            (option) => option === member || !isNamedKey(option) || !isRow(child(option, 'value')),
        )
        .map((option) => ({
            data: { name: propertyKeyName(option) ?? '…' },
            messageId: 'option',
            node: option,
        }));
}

/** What the composition's own members hold that no composition may. */
function compositionFindings(
    composition: AstNode,
    imports: ReadonlyMap<string, string>,
): FacetFinding[] {
    return childList(composition, 'properties').flatMap((member): FacetFinding[] => {
        const key = propertyKeyName(member);
        if (key === 'capabilities' || key === 'actions') {
            return unlisted(member, imports);
        }
        return key === 'options'
            ? unrowed(member)
            : [{ data: { key: key ?? '…' }, messageId: 'member', node: member }];
    });
}

/** Is the facet's member one it names — the composition spread, or a reference imported? */
function isNamed(property: AstNode, imports: ReadonlyMap<string, string>): boolean {
    if (property.type === 'SpreadElement') {
        return identifierName(child(property, 'argument')) === 'composition';
    }
    const value = child(property, 'value');
    return (
        propertyKeyName(property) === 'engines' ||
        (isNamedKey(property) && isReference(value) && imports.has(rootOf(value) ?? ''))
    );
}

/** What `defineFacet` is handed, and what the facet object writes inline rather than names. */
function facetFindings(
    defined: DefinedFacet,
    imports: ReadonlyMap<string, string>,
): FacetFinding[] {
    const { facet } = defined;
    const handed = defined.handed.map((argument) => ({
        data: { what: kindOf(unwrapped(argument)) },
        messageId: 'defined' as const,
        node: argument,
    }));
    const adapters = adaptersOf(facet);
    if (adapters === undefined) {
        return [...handed, { messageId: 'engines', node: facet }];
    }
    const unwired = childList(adapters, 'properties')
        .filter((adapter) => !isNamedKey(adapter) || !isAdapter(child(adapter, 'value'), imports))
        .map((adapter) => ({
            data: {
                port: propertyKeyName(adapter) ?? '…',
                what: kindOf(unwrapped(child(adapter, 'value')) ?? adapter),
            },
            messageId: 'adapter' as const,
            node: adapter,
        }));
    const inline = childList(facet, 'properties')
        .filter((property) => !isNamed(property, imports))
        .map((property) => ({
            data: {
                key: propertyKeyName(property) ?? '…',
                what: kindOf(unwrapped(child(property, 'value'))),
            },
            messageId: 'inline' as const,
            node: property,
        }));
    return [...handed, ...unwired, ...inline];
}

/**
 * Every finding of a facet file: a statement that is none of its imports,
 * its composition, its chain interface and its `defineFacet(…)`; and what the
 * composition or the facet writes inline rather than names.
 */
export function facetFileFindings(program: AstNode): FacetFinding[] {
    const imports = importsOf(program);
    return childList(program, 'body').flatMap((statement): FacetFinding[] => {
        const defined = definedFacet(statement);
        const composition = compositionOf(statement);
        if (defined !== undefined) {
            return facetFindings(defined, imports);
        }
        if (composition !== undefined) {
            return compositionFindings(composition, imports);
        }
        return statement.type === 'ImportDeclaration' || isChainType(statement)
            ? []
            : [{ data: { stray: strayOf(statement) }, messageId: 'stray', node: statement }];
    });
}
