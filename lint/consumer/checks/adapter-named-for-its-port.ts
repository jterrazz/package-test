import { basename, dirname, join, relative } from 'node:path';

import {
    child,
    childList,
    identifierName,
    isNode,
    nodeStart,
    stringValue,
    walk,
} from '../../kit/project/ast.js';
import type { AstNode } from '../../kit/project/ast.js';
import { parseProgram } from '../../kit/project/module-parser.js';
import { resolveSpecifier } from '../../kit/project/specifiers.js';
import { modulesUnder, setupFolderOf } from '../../kit/project/specs-modules.js';
import { findSpecsRoots, isWithin, lineAt, readText } from '../../kit/project/tree.js';
import type { Spotted } from './checker.js';

const ADAPTER_SUFFIX = '.adapter.ts';

type Implementer = { at: number; name: string; port: string };

// invariant: `TickerSourcePort` → `ticker-source`, `HTTPClientPort` → `http-client`: a word opens on a capital after a lower case letter or a digit, or on the last capital of a run before a lower case letter.
const WORD_START = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/gu;

const PORT_SUFFIX = /Port$/u;

function adapterNameOf(port: string): string {
    const subject = port.replace(PORT_SUFFIX, '') || port;
    return `${subject.replaceAll(WORD_START, '-').toLowerCase()}${ADAPTER_SUFFIX}`;
}

type PortsImported = { names: Map<string, string>; namespaces: Set<string> };

function importedName(specifier: AstNode): string | undefined {
    const imported = child(specifier, 'imported');
    return identifierName(imported) ?? stringValue(imported);
}

function portsImported(specsRoot: string, file: string, program: AstNode): PortsImported {
    const ports: PortsImported = { names: new Map(), namespaces: new Set() };
    for (const statement of childList(program, 'body')) {
        if (statement.type !== 'ImportDeclaration') {
            continue;
        }
        const source = String(stringValue(child(statement, 'source')));
        const targets = resolveSpecifier(file, source);
        if (targets.length === 0 || targets.some((target) => isWithin(specsRoot, target))) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            const local = String(identifierName(child(specifier, 'local')));
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
    if (
        (ports.namespaces as ReadonlySet<unknown>).has(identifierName(child(expression, 'object')))
    ) {
        return identifierName(child(expression, 'property'));
    }
    return (ports.names as ReadonlyMap<unknown, string>).get(identifierName(expression));
}

function implementersOf(program: AstNode, ports: PortsImported): Implementer[] {
    const found: Implementer[] = [];
    walk(program, (node) => {
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

function misnamedAdapters(rootDir: string, specsRoot: string): Spotted[] {
    const found: Spotted[] = [];
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
            path: relative(rootDir, file),
            line: lineAt(text, first.at),
            fix: `name the file for the port it replaces: \`specs/${named}\` — the class keeps whatever name it has`,
            found: `\`${basename(file)}\`, whose \`${first.name}\` implements the port \`${first.port}\``,
            rule: 'adapter-named-for-its-port',
        });
    }
    return found;
}

export function checkAdapterNamedForItsPort(rootDir: string): Spotted[] {
    return findSpecsRoots(rootDir).flatMap((specsRoot) => misnamedAdapters(rootDir, specsRoot));
}
