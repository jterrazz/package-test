import {
    child,
    childList,
    findProperty,
    identifierName,
    isNamedKey,
    isReference,
    propertyKeyName,
    rootOf,
    stringValue,
    unwrapped,
} from '../../../kit/project/ast.js';
import type { AstNode } from '../../../kit/project/ast.js';
import { isAdapter, isRow } from './specification-is-a-composition.values.js';

export type CompositionFinding = {
    readonly data?: Record<string, string>;
    readonly messageId:
        | 'adapter'
        | 'adapters'
        | 'defined'
        | 'inline'
        | 'listed'
        | 'member'
        | 'option'
        | 'stray';
    readonly node: AstNode;
};

export function layerOf(source: string): 'composition' | 'definition' | 'result' | undefined {
    if (/\.(?:capability|action)\.js$/u.test(source)) {
        return 'definition';
    }
    if (source.endsWith('.composition.js')) {
        return 'composition';
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

type DefinedSpecification = { readonly definition: AstNode; readonly handed: AstNode[] };

function definedSpecification(statement: AstNode): DefinedSpecification | undefined {
    const init = child(constDeclarator(child(statement, 'declaration')), 'init');
    const inner = child(init, 'callee');
    const [definition] = childList(init, 'arguments');
    return init?.type === 'CallExpression' &&
        inner?.type === 'CallExpression' &&
        identifierName(child(inner, 'callee')) === 'defineSpecification' &&
        definition?.type === 'ObjectExpression'
        ? { definition, handed: childList(inner, 'arguments') }
        : undefined;
}

function isChainType(statement: AstNode): boolean {
    const declared =
        statement.type === 'ExportNamedDeclaration' ? child(statement, 'declaration') : statement;
    return declared?.type === 'TSInterfaceDeclaration';
}

/** Only when written as an arrow whose every parameter is a bare name, typed or not. */
function adaptersOf(definition: AstNode): AstNode | undefined {
    const arrow = child(findProperty(definition, 'adapters'), 'value');
    const body = unwrapped(child(arrow, 'body'));
    return arrow?.type === 'ArrowFunctionExpression' &&
        childList(arrow, 'params').every((parameter) => parameter.type === 'Identifier') &&
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

function unlisted(member: AstNode, imports: ReadonlyMap<string, string>): CompositionFinding[] {
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

function unrowed(member: AstNode): CompositionFinding[] {
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
): CompositionFinding[] {
    return childList(composition, 'properties').flatMap((member): CompositionFinding[] => {
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
        propertyKeyName(property) === 'adapters' ||
        (isNamedKey(property) && isReference(value) && imports.has(rootOf(value) ?? ''))
    );
}

function specificationFindings(
    defined: DefinedSpecification,
    imports: ReadonlyMap<string, string>,
): CompositionFinding[] {
    const { definition } = defined;
    const handed = defined.handed.map((argument) => ({
        data: { what: kindOf(unwrapped(argument)) },
        messageId: 'defined' as const,
        node: argument,
    }));
    const adapters = adaptersOf(definition);
    if (adapters === undefined) {
        return [...handed, { messageId: 'adapters', node: definition }];
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
    const inline = childList(definition, 'properties')
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

export function compositionFileFindings(program: AstNode): CompositionFinding[] {
    const imports = importsOf(program);
    return childList(program, 'body').flatMap((statement): CompositionFinding[] => {
        const defined = definedSpecification(statement);
        const composition = compositionOf(statement);
        if (defined !== undefined) {
            return specificationFindings(defined, imports);
        }
        if (composition !== undefined) {
            return compositionFindings(composition, imports);
        }
        return statement.type === 'ImportDeclaration' || isChainType(statement)
            ? []
            : [{ data: { stray: strayOf(statement) }, messageId: 'stray', node: statement }];
    });
}
