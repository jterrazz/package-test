import { dirname, resolve } from 'node:path';

import { child, childList, identifierName, memberPropertyName, stringValue, walk } from './ast.js';
import { projectRootOf } from './role.js';
import type { AstNode, Visitor } from './rule-shape.js';

export type PathReference = { node: AstNode; path: string };

const FS_READ = /^(?:createReadStream|opendir(?:Sync)?|read\w*)$/u;

const PATH_BUILDERS = new Set(['join', 'resolve']);

const COMMONJS_ANCHORS = new Set(['__dirname', '__filename']);

function isOwnDirectory(node: AstNode | undefined): boolean {
    return (
        identifierName(node) === '__dirname' ||
        (node?.type === 'MemberExpression' &&
            child(node, 'object')?.type === 'MetaProperty' &&
            memberPropertyName(node) === 'dirname')
    );
}

function calleeName(node: AstNode): string | undefined {
    const callee = child(node, 'callee');
    return (
        identifierName(callee) ?? (callee === undefined ? undefined : memberPropertyName(callee))
    );
}

function argumentsOf(node: AstNode): AstNode[] {
    return childList(node, 'arguments');
}

function isImportMetaUrl(node: AstNode | undefined): boolean {
    return (
        node?.type === 'MemberExpression' &&
        child(node, 'object')?.type === 'MetaProperty' &&
        memberPropertyName(node) === 'url'
    );
}

function isAnchor(node: AstNode | undefined, anchors: Set<string>): boolean {
    if (node === undefined) {
        return false;
    }
    let found = false;
    walk(node, (inner) => {
        if (inner.type === 'MetaProperty') {
            found = true;
        } else {
            const name = identifierName(inner) ?? '';
            found ||= COMMONJS_ANCHORS.has(name) || anchors.has(name);
        }
    });
    return found;
}

function anchorsOf(program: AstNode): Set<string> {
    const anchors = new Set<string>();
    for (const statement of childList(program, 'body')) {
        const declaration =
            statement.type === 'ExportNamedDeclaration'
                ? child(statement, 'declaration')
                : statement;
        for (const declarator of childList(declaration, 'declarations')) {
            const name = identifierName(child(declarator, 'id'));
            if (name !== undefined && isAnchor(child(declarator, 'init'), anchors)) {
                anchors.add(name);
            }
        }
    }
    return anchors;
}

function literalTail(pieces: AstNode[]): string[] {
    const tail: string[] = [];
    for (const piece of pieces) {
        const value = stringValue(piece);
        if (value === undefined) {
            break;
        }
        tail.push(value);
    }
    return tail;
}

/** `join(import.meta.dirname, 'fixtures', name)` names `<here>/fixtures`. */
function anchoredPath(node: AstNode, here: string, anchors: Set<string>): string | undefined {
    if (node.type === 'CallExpression' && PATH_BUILDERS.has(calleeName(node) ?? '')) {
        const [first, ...rest] = argumentsOf(node);
        const tail = literalTail(rest);
        if (!isAnchor(first, anchors) || tail.length === 0) {
            return undefined;
        }
        return resolve(here, ...tail);
    }
    if (node.type === 'TemplateLiteral') {
        const [hole] = childList(node, 'expressions');
        const quasis = childList(node, 'quasis');
        const cooked = (index: number): string => {
            const value = quasis[index]?.value;
            const text =
                typeof value === 'object' && value !== null && 'cooked' in value
                    ? value.cooked
                    : undefined;
            return typeof text === 'string' ? text : '';
        };
        if (!isAnchor(hole, anchors) || cooked(0) !== '' || !cooked(1).startsWith('/')) {
            return undefined;
        }
        return resolve(here, `.${cooked(1)}`);
    }
    return undefined;
}

function urlLiteral(node: AstNode): undefined | { literal: string; target: AstNode } {
    const [target, base] = argumentsOf(node);
    const literal = stringValue(target);
    return identifierName(child(node, 'callee')) === 'URL' &&
        target !== undefined &&
        literal !== undefined &&
        isImportMetaUrl(base)
        ? { literal, target }
        : undefined;
}

/** Its `Program` handler reads the module's place and anchors first, so it must see the program before any node inside it. */
export function pathReferenceVisitor(
    file: () => string,
    onPath: (entry: PathReference) => void,
): Visitor {
    let here = '';
    let anchors = new Set<string>();
    const anchored = (node: AstNode): void => {
        const path = anchoredPath(node, here, anchors);
        if (path !== undefined) {
            onPath({ node, path });
        }
    };
    return {
        CallExpression(node: AstNode) {
            anchored(node);
            const [first] = argumentsOf(node);
            const literal = stringValue(first);
            if (
                FS_READ.test(calleeName(node) ?? '') &&
                first !== undefined &&
                literal !== undefined &&
                /^\.\.?\//u.test(literal)
            ) {
                onPath({ node: first, path: resolve(projectRootOf(here) ?? here, literal) });
            }
        },
        NewExpression(node: AstNode) {
            const url = urlLiteral(node);
            if (url !== undefined) {
                onPath({ node: url.target, path: resolve(here, url.literal) });
            }
        },
        Program(node: AstNode) {
            here = dirname(file());
            anchors = anchorsOf(node);
        },
        TemplateLiteral: anchored,
    };
}

export type LiteralPath = { node: AstNode; pieces: string[] };

/** A piece that is not a literal leaves the call out. */
export function literalPathVisitor(onPath: (entry: LiteralPath) => void): Visitor {
    return {
        CallExpression(node: AstNode) {
            if (!PATH_BUILDERS.has(calleeName(node) ?? '')) {
                return;
            }
            const [anchor, ...rest] = argumentsOf(node);
            const pieces = literalTail(rest);
            const [head] = rest;
            if (isOwnDirectory(anchor) && head !== undefined && pieces.length === rest.length) {
                onPath({ node: head, pieces });
            }
        },
        NewExpression(node: AstNode) {
            const url = urlLiteral(node);
            if (url !== undefined) {
                onPath({ node: url.target, pieces: [url.literal] });
            }
        },
    };
}

export function mergeVisitors(...fragments: Visitor[]): Visitor {
    const merged: Visitor = {};
    for (const fragment of fragments) {
        for (const [type, handler] of Object.entries(fragment)) {
            const before = merged[type];
            merged[type] =
                before === undefined
                    ? handler
                    : (node: AstNode) => {
                          before(node);
                          handler(node);
                      };
        }
    }
    return merged;
}

export function visitProgram(program: AstNode, visitor: Visitor): void {
    walk(program, (node) => {
        visitor[node.type]?.(node);
    });
}
