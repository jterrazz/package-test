import { basename, dirname, join, relative } from 'node:path';

import {
    child,
    childList,
    identifierName,
    isNode,
    nodeStart,
    stringValue,
    walk,
} from '../../engine/project/ast.js';
import type { AstNode } from '../../engine/project/ast.js';
import { parseProgram } from '../../engine/project/module-parser.js';
import { resolveSpecifier } from '../../engine/project/production.js';
import { modulesUnder, setupFolderOf } from '../../engine/project/specs-modules.js';
import { findSpecsRoots, isWithin, lineAt, readText } from '../../engine/project/tree.js';
import type { Finding } from './checker.js';

const ADAPTER_SUFFIX = '.adapter.ts';

type Implementer = { at: number; name: string; port: string };

function isUpper(char: string | undefined): boolean {
    return char !== undefined && char !== char.toLowerCase();
}

function kebabOf(name: string): string {
    let kebab = '';
    for (let index = 0; index < name.length; index += 1) {
        const char = name.charAt(index);
        const after = name[index + 1];
        const opensWord =
            index > 0 &&
            isUpper(char) &&
            (!isUpper(name[index - 1]) || (after !== undefined && !isUpper(after)));
        kebab += `${opensWord ? '-' : ''}${char.toLowerCase()}`;
    }
    return kebab;
}

function adapterNameOf(port: string): string {
    return `${kebabOf(port.replace(/Port$/u, '') || port)}${ADAPTER_SUFFIX}`;
}

type PortsImported = { names: Map<string, string>; namespaces: Set<string> };

function importedName(specifier: AstNode): string | undefined {
    const imported = child(specifier, 'imported');
    return identifierName(imported) ?? stringValue(imported);
}

function portsImported(specsRoot: string, file: string, program: AstNode): PortsImported {
    const ports: PortsImported = { names: new Map(), namespaces: new Set() };
    for (const statement of childList(program, 'body')) {
        const source = stringValue(child(statement, 'source'));
        if (statement.type !== 'ImportDeclaration' || source === undefined) {
            continue;
        }
        const targets = resolveSpecifier(file, source);
        if (targets.length === 0 || targets.some((target) => isWithin(specsRoot, target))) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            const local = identifierName(child(specifier, 'local'));
            if (local === undefined) {
                continue;
            }
            if (specifier.type === 'ImportNamespaceSpecifier') {
                ports.namespaces.add(local);
            } else {
                ports.names.set(local, importedName(specifier) ?? local);
            }
        }
    }
    return ports;
}

function portOf(expression: AstNode | undefined, ports: PortsImported): string | undefined {
    if (expression?.type === 'MemberExpression') {
        const namespace = identifierName(child(expression, 'object'));
        return namespace !== undefined && ports.namespaces.has(namespace)
            ? identifierName(child(expression, 'property'))
            : undefined;
    }
    const local = identifierName(expression);
    return local === undefined ? undefined : ports.names.get(local);
}

function implementersOf(program: AstNode, ports: PortsImported): Implementer[] {
    const found: Implementer[] = [];
    walk(program, (node) => {
        if (node.type !== 'ClassDeclaration' && node.type !== 'ClassExpression') {
            return;
        }
        for (const clause of childList(node, 'implements')) {
            const port = portOf(child(clause, 'expression'), ports);
            if (port !== undefined) {
                found.push({
                    at: nodeStart(node),
                    name: identifierName(child(node, 'id')) ?? 'the class',
                    port,
                });
            }
        }
    });
    return found;
}

function misnamedAdapters(rootDir: string, specsRoot: string): Finding[] {
    const found: Finding[] = [];
    for (const file of modulesUnder(specsRoot)) {
        if (setupFolderOf(specsRoot, file) === undefined) {
            continue;
        }
        const text = readText(file);
        const program = parseProgram(file, text);
        if (!isNode(program)) {
            continue;
        }
        const implementers = implementersOf(program, portsImported(specsRoot, file, program));
        const names = implementers.map(({ port }) => adapterNameOf(port));
        const [first] = implementers;
        if (first === undefined || names.includes(basename(file))) {
            continue;
        }
        const named = relative(specsRoot, join(dirname(file), adapterNameOf(first.port)));
        found.push({
            file: relative(rootDir, file),
            line: lineAt(text, first.at),
            fix: `name the file for the port it replaces: \`specs/${named}\` — the class keeps whatever name it has`,
            found: `\`${basename(file)}\`, whose \`${first.name}\` implements the port \`${first.port}\``,
            rule: 'adapter-named-for-its-port',
        });
    }
    return found;
}

export function checkAdapterNamedForItsPort(rootDir: string): Finding[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => misnamedAdapters(rootDir, specsRoot));
}
