import { dirname, resolve } from 'node:path';

import { child, childList, identifierName, memberPropertyName, stringValue, walk } from './ast.js';
import { projectRootOf } from './role.js';
import type { AstNode, Visitor } from './rule-shape.js';

/**
 * The paths a module names in its own tree — what it builds from where it
 * sits (`new URL('…', import.meta.url)`, `join(import.meta.dirname, …)`, a
 * template opening on `__dirname`) or reads by a relative literal
 * (`readFileSync('./…')`). F2 judges each for the module oxlint hands it,
 * and the walk through a module that is not production judges the same
 * forms in the module it parses.
 */

/** A path a module names, and the node that names it. */
export type PathReference = { node: AstNode; path: string };

/** The calls that read a file or a folder by its path. */
const FS_READ = /^(?:createReadStream|opendir(?:Sync)?|read\w*)$/u;

/** The calls that build a path from pieces. */
const PATH_BUILDERS = new Set(['join', 'resolve']);

/** The names a CommonJS module is handed for where it sits. */
const COMMONJS_ANCHORS = new Set(['__dirname', '__filename']);

/** The name a call's callee goes by — `readFileSync`, `fs.readFileSync`, `path.join`. */
function calleeName(node: AstNode): string | undefined {
    const callee = child(node, 'callee');
    return (
        identifierName(callee) ?? (callee === undefined ? undefined : memberPropertyName(callee))
    );
}

/** The arguments of a call or a `new`. */
function argumentsOf(node: AstNode): AstNode[] {
    return childList(node, 'arguments');
}

/** Is this `import.meta.url` — what a `new URL(…)` resolves against? */
function isImportMetaUrl(node: AstNode | undefined): boolean {
    return (
        node?.type === 'MemberExpression' &&
        child(node, 'object')?.type === 'MetaProperty' &&
        memberPropertyName(node) === 'url'
    );
}

/**
 * Does this expression name where the module sits — `import.meta.*`,
 * `__dirname`, `__filename`, or a module-scope binding made of one?
 */
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

/** The module-scope bindings initialised from where the module sits. */
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

/** The literal pieces a path builder is handed after its anchor, up to the first that is not one. */
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

/**
 * The path an anchored expression names in the module's own tree, up to its
 * first piece that is not a literal: `join(import.meta.dirname, 'fixtures',
 * name)` names `<here>/fixtures`, `` `${__dirname}/seeds/rows.sql` `` the file.
 */
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

/**
 * Visitor fragment for every path a module names in its own tree — the module
 * `file()` returns, asked when its program is entered, so one fragment serves
 * every file of a run. Its `Program` handler reads where the module sits and
 * its module-scope anchors first, so it is handed the program before any node
 * inside it.
 */
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
            const [target, base] = argumentsOf(node);
            const literal = stringValue(target);
            if (
                identifierName(child(node, 'callee')) === 'URL' &&
                target !== undefined &&
                literal !== undefined &&
                isImportMetaUrl(base)
            ) {
                onPath({ node: target, path: resolve(here, literal) });
            }
        },
        Program(node: AstNode) {
            here = dirname(file());
            anchors = anchorsOf(node);
        },
        TemplateLiteral: anchored,
    };
}

/** Visitors run together: each node type calls every fragment that handles it, in order. */
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

/** Run a visitor over a whole program, the way oxlint would, entering each node once. */
export function visitProgram(program: AstNode, visitor: Visitor): void {
    walk(program, (node) => {
        visitor[node.type]?.(node);
    });
}
