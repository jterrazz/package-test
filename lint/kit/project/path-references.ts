import { dirname, resolve } from 'node:path';

import {
    child,
    childList,
    cookedText,
    identifierName,
    memberPropertyName,
    stringValue,
    walk,
} from './ast.js';
import type { AstNode, Visitor } from './ast.js';
import { projectRootOf } from './role.js';

export type PathReference = { node: AstNode; path: string };

type LiteralArgument = { literal: string; target: AstNode };

const FS_READ = /^(?:createReadStream|opendir(?:Sync)?|read\w*)$/u;

const RELATIVE = /^\.\.?\//u;

const PATH_BUILDERS = new Set(['join', 'resolve']);

const COMMONJS_ANCHORS = ['__dirname', '__filename'];

function isMetaMember(node: AstNode | undefined, name: string): boolean {
    return child(node, 'object')?.type === 'MetaProperty' && memberPropertyName(node) === name;
}

function isOwnDirectory(node: AstNode | undefined): boolean {
    return identifierName(node) === '__dirname' || isMetaMember(node, 'dirname');
}

function calleeName(node: AstNode): string | undefined {
    const callee = child(node, 'callee');
    return identifierName(callee) ?? memberPropertyName(callee);
}

function argumentsOf(node: AstNode): AstNode[] {
    return childList(node, 'arguments');
}

function literalArguments(node: AstNode): (LiteralArgument | undefined)[] {
    return argumentsOf(node).map((target) => {
        const literal = stringValue(target);
        return literal === undefined ? undefined : { literal, target };
    });
}

function isAnchor(node: AstNode | undefined, anchors: ReadonlySet<string | undefined>): boolean {
    if (node === undefined) {
        return false;
    }
    let found = false;
    walk(node, (inner) => {
        found ||= inner.type === 'MetaProperty' || anchors.has(identifierName(inner));
    });
    return found;
}

function anchorsOf(program: AstNode): Set<string | undefined> {
    const anchors = new Set<string | undefined>(COMMONJS_ANCHORS);
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

/** `join(import.meta.dirname, '_fixtures', name)` names `<here>/_fixtures`. */
function builtPath(
    node: AstNode,
    here: string,
    anchors: ReadonlySet<string | undefined>,
): string | undefined {
    const [first, ...rest] = argumentsOf(node);
    const tail = literalTail(rest);
    if (
        !(PATH_BUILDERS as ReadonlySet<unknown>).has(calleeName(node)) ||
        !isAnchor(first, anchors) ||
        tail.length === 0
    ) {
        return undefined;
    }
    return resolve(here, ...tail);
}

/** `` `${import.meta.dirname}/_fixtures/a.json` `` names `<here>/_fixtures/a.json`. */
function templatePath(
    node: AstNode,
    here: string,
    anchors: ReadonlySet<string | undefined>,
): string | undefined {
    const [hole] = childList(node, 'expressions');
    const [head, tail] = childList(node, 'quasis').map(cookedText);
    // Stryker disable next-line OptionalChaining: an anchored hole always has a text after it
    if (!isAnchor(hole, anchors) || head !== '' || tail?.startsWith('/') !== true) {
        return undefined;
    }
    return resolve(here, `.${tail}`);
}

function urlLiteral(node: AstNode): LiteralArgument | undefined {
    const [first] = literalArguments(node);
    const [, base] = argumentsOf(node);
    return identifierName(child(node, 'callee')) === 'URL' && isMetaMember(base, 'url')
        ? first
        : undefined;
}

/** Its `Program` handler reads the module's anchors first, so it must see the program before any node inside it. */
export function pathReferenceVisitor(
    file: () => string,
    onPath: (entry: PathReference) => void,
): Visitor {
    const here = (): string => dirname(file());
    let anchors = new Set<string | undefined>();
    const report = (node: AstNode, path: string | undefined): void => {
        if (path !== undefined) {
            onPath({ node, path });
        }
    };
    return {
        CallExpression(node: AstNode) {
            const place = here();
            report(node, builtPath(node, place, anchors));
            const [first] = literalArguments(node);
            if (
                first !== undefined &&
                FS_READ.test(calleeName(node) ?? '') &&
                RELATIVE.test(first.literal)
            ) {
                onPath({
                    node: first.target,
                    path: resolve(projectRootOf(place) ?? place, first.literal),
                });
            }
        },
        NewExpression(node: AstNode) {
            const url = urlLiteral(node);
            if (url !== undefined) {
                onPath({ node: url.target, path: resolve(here(), url.literal) });
            }
        },
        Program(node: AstNode) {
            anchors = anchorsOf(node);
        },
        TemplateLiteral(node: AstNode) {
            report(node, templatePath(node, here(), anchors));
        },
    };
}

export type LiteralPath = { node: AstNode; pieces: string[] };

/** A piece that is not a literal leaves the call out. */
export function literalPathVisitor(onPath: (entry: LiteralPath) => void): Visitor {
    return {
        CallExpression(node: AstNode) {
            if (!(PATH_BUILDERS as ReadonlySet<unknown>).has(calleeName(node))) {
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
