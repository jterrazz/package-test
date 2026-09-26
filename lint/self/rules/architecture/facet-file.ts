import {
    child,
    childList,
    findProperty,
    identifierName,
    propertyKeyName,
    stringValue,
} from '../../../reading/ast.js';
import type { AstNode } from '../../../reading/ast.js';
import { isAdapter, isNamedKey, isReference, isRow, rootOf, unwrapped } from './facet-values.js';

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

export function layerOf(source: string): 'definition' | 'facet' | 'result' | undefined {
    if (/\.(?:capability|action)\.js$/u.test(source)) {
        return 'definition';
    }
    if (source.endsWith('.facet.js')) {
        return 'facet';
    }
    return source.endsWith('.result.js') || /(?:^|\/)expectations\//u.test(source)
        ? 'result'
        : undefined;
}

function constDeclarator(statement: AstNode | undefined): AstNode | undefined {
    const declarators = childList(statement, 'declarations');
    return statement?.type === 'VariableDeclaration' &&
        statement.kind === 'const' &&
        declarators.length === 1
        ? declarators[0]
        : undefined;
}

function compositionOf(statement: AstNode): AstNode | undefined {
    const declarator = constDeclarator(statement);
    const init = unwrapped(child(declarator, 'init'));
    return identifierName(child(declarator, 'id')) === 'composition' &&
        init?.type === 'ObjectExpression'
        ? init
        : undefined;
}

type DefinedFacet = { readonly facet: AstNode; readonly handed: AstNode[] };

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

function isChainType(statement: AstNode): boolean {
    const declared =
        statement.type === 'ExportNamedDeclaration' ? child(statement, 'declaration') : statement;
    return declared?.type === 'TSInterfaceDeclaration';
}

/** Only when written as an arrow whose every parameter is a bare name, typed or not. */
function adaptersOf(facet: AstNode): AstNode | undefined {
    const engines = child(findProperty(facet, 'engines'), 'value');
    const body = unwrapped(child(engines, 'body'));
    return engines?.type === 'ArrowFunctionExpression' &&
        childList(engines, 'params').every((parameter) => parameter.type === 'Identifier') &&
        body?.type === 'ObjectExpression'
        ? body
        : undefined;
}

/** `FunctionDeclaration` → `function declaration`. */
function kindOf(node: AstNode | undefined): string {
    return (node?.type ?? 'nothing')
        .replaceAll(/(?<lower>[a-z])(?<upper>[A-Z])/gu, '$<lower> $<upper>')
        .toLowerCase();
}

function strayOf(statement: AstNode): string {
    return kindOf(
        statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
            ? (child(statement, 'declaration') ?? statement)
            : statement,
    );
}

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
