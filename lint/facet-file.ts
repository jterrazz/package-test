import {
    child,
    childList,
    findProperty,
    identifierName,
    propertyKeyName,
    stringValue,
} from './ast.js';
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
    readonly messageId: 'adapter' | 'engines' | 'inline' | 'listed' | 'member' | 'option' | 'stray';
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

/** The object of `const composition = { … }`, written with `as const` or a `satisfies`. */
function compositionOf(statement: AstNode): AstNode | undefined {
    const declarator = constDeclarator(statement);
    const init = unwrapped(child(declarator, 'init'));
    return identifierName(child(declarator, 'id')) === 'composition' &&
        init?.type === 'ObjectExpression'
        ? init
        : undefined;
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

/** The object `engines: (config) => ({ … })` hands back, when it is written so. */
function adaptersOf(facet: AstNode): AstNode | undefined {
    const engines = child(findProperty(facet, 'engines'), 'value');
    const body = unwrapped(child(engines, 'body'));
    return engines?.type === 'ArrowFunctionExpression' && body?.type === 'ObjectExpression'
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

/** An identifier, or a property read off one — a name, never logic. */
function isReference(node: AstNode | undefined): boolean {
    const read = unwrapped(node);
    return (
        read?.type === 'Identifier' ||
        (read?.type === 'MemberExpression' &&
            (read.computed !== true || stringValue(child(read, 'property')) !== undefined) &&
            isReference(child(read, 'object')))
    );
}

/** The identifier a reference is read off: `config.jobs` → `config`. */
function rootOf(node: AstNode | undefined): string | undefined {
    const read = unwrapped(node);
    return read?.type === 'MemberExpression' ? rootOf(child(read, 'object')) : identifierName(read);
}

/** A reference, a literal, a list of them, or one falling back to another (`config.jobs ?? []`). */
function isPlainValue(node: AstNode | undefined): boolean {
    const value = unwrapped(node);
    return (
        isReference(value) ||
        value?.type === 'Literal' ||
        (value?.type === 'ArrayExpression' && childList(value, 'elements').every(isPlainValue)) ||
        (value?.type === 'LogicalExpression' &&
            isPlainValue(child(value, 'left')) &&
            isPlainValue(child(value, 'right')))
    );
}

/** An adapter: a plain value, or a seam's constructor called (or `new`ed) on plain values. */
function isAdapter(node: AstNode | undefined, imports: ReadonlyMap<string, string>): boolean {
    const value = unwrapped(node);
    if (value?.type !== 'CallExpression' && value?.type !== 'NewExpression') {
        return isPlainValue(value);
    }
    const built = identifierName(child(value, 'callee'));
    return (
        built !== undefined &&
        /(?:^|\/)seams\//u.test(imports.get(built) ?? '') &&
        childList(value, 'arguments').every(isPlainValue)
    );
}

/** Is the option a matrix row written as string literals alone? */
function isRow(node: AstNode | undefined): boolean {
    const row = unwrapped(node);
    return (
        row?.type === 'ObjectExpression' &&
        childList(row, 'properties').every(
            (field) =>
                field.type === 'Property' &&
                stringValue(unwrapped(child(field, 'value'))) !== undefined,
        )
    );
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
        .filter((option) => option === member || !isRow(child(option, 'value')))
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
        (isReference(value) && imports.has(rootOf(value) ?? ''))
    );
}

/** What the object handed to `defineFacet` writes inline rather than names. */
function facetFindings(facet: AstNode, imports: ReadonlyMap<string, string>): FacetFinding[] {
    const adapters = adaptersOf(facet);
    if (adapters === undefined) {
        return [{ messageId: 'engines', node: facet }];
    }
    const unwired = childList(adapters, 'properties')
        .filter((adapter) => !isAdapter(child(adapter, 'value'), imports))
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
    return [...unwired, ...inline];
}

/**
 * Every finding of a facet file: a statement that is none of its imports,
 * its composition, its chain interface and its `defineFacet(…)`; and what the
 * composition or the facet writes inline rather than names.
 */
export function facetFileFindings(program: AstNode): FacetFinding[] {
    const imports = importsOf(program);
    return childList(program, 'body').flatMap((statement): FacetFinding[] => {
        const facet = definedFacet(statement);
        const composition = compositionOf(statement);
        if (facet !== undefined) {
            return facetFindings(facet, imports);
        }
        if (composition !== undefined) {
            return compositionFindings(composition, imports);
        }
        return statement.type === 'ImportDeclaration' || isChainType(statement)
            ? []
            : [{ data: { stray: strayOf(statement) }, messageId: 'stray', node: statement }];
    });
}
