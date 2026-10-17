import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Spotted } from '../../kit/checker/registry.js';
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
import { byPosition, finding, isProduction, listed } from '../../kit/project/source.js';
import { positionOf } from '../../kit/project/spec-subjects.js';
import type { SelfPassId } from './checker.js';

const SYNONYM = /\.driver(?<tail>(?:\.[a-z-]+)*)\.(?<extension>tsx?)$/u;

const ADAPTER = /\.adapter\.tsx?$/u;

function synonymOf(path: string): Spotted<SelfPassId> {
    const name = path.split('/').at(-1) ?? '';
    const { extension = 'ts', tail = '' } = SYNONYM.exec(name)?.groups ?? {};
    return finding('one-word-for-an-adapter', path, {
        fix: `rename it \`<what it adapts>.adapter${tail}.${extension}\` (the process clock's is \`process-clock.adapter.ts\`) and the paths that import it`,
        found: `\`${name}\` carries the suffix \`.driver\`, a second word for an adapter`,
    });
}

function portsImported(program: AstNode): ReadonlySet<string> {
    const names = new Set<string>();
    for (const statement of childList(program, 'body')) {
        if (
            statement.type === 'ImportDeclaration' &&
            stringValue(child(statement, 'source'))?.endsWith('.port.js') === true
        ) {
            for (const specifier of childList(statement, 'specifiers')) {
                const local = identifierName(child(specifier, 'local'));
                if (local?.endsWith('Port') === true) {
                    names.add(local);
                }
            }
        }
    }
    return names;
}

function referencedName(annotation: AstNode | undefined): string | undefined {
    return annotation?.type === 'TSTypeReference'
        ? identifierName(child(annotation, 'typeName'))
        : undefined;
}

function implementedPort(node: AstNode, ports: ReadonlySet<string>): string | undefined {
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        return childList(node, 'implements')
            .map((clause) => identifierName(child(clause, 'expression')))
            .find((name) => name !== undefined && ports.has(name));
    }
    const annotated = child(child(node, 'id'), 'typeAnnotation');
    const literal =
        node.type === 'VariableDeclarator'
            ? child(node, 'init')?.type === 'ObjectExpression' &&
              referencedName(child(annotated, 'typeAnnotation'))
            : node.type === 'TSSatisfiesExpression' &&
              child(node, 'expression')?.type === 'ObjectExpression' &&
              referencedName(child(node, 'typeAnnotation'));
    return typeof literal === 'string' && ports.has(literal) ? literal : undefined;
}

function unsuffixedImplementations(root: string, path: string): Spotted<SelfPassId>[] {
    const text = readFileSync(resolve(root, path), 'utf8');
    const program = parseProgram(path, text);
    if (!isNode(program)) {
        return [];
    }
    const ports = portsImported(program);
    const name = path.split('/').at(-1) ?? '';
    const found: Spotted<SelfPassId>[] = [];
    walk(program, (node) => {
        const port = ports.size === 0 ? undefined : implementedPort(node, ports);
        if (port === undefined) {
            return;
        }
        const at = positionOf(text, nodeStart(node));
        found.push(
            finding(
                'one-word-for-an-adapter',
                path,
                {
                    fix: 'rename it `<what it adapts>.adapter.ts`, and the paths that import it',
                    found: `\`${name}\` implements \`${port}\` without the suffix \`.adapter\``,
                },
                at,
            ),
        );
    });
    return found;
}

export function checkOneWordForAnAdapter(root: string): Spotted<SelfPassId>[] {
    const files = listed(resolve(root, 'src'), 'src').filter(({ directory }) => !directory);
    return [
        ...files.filter(({ path }) => SYNONYM.test(path)).map(({ path }) => synonymOf(path)),
        ...files
            .filter(({ path }) => isProduction(path) && !ADAPTER.test(path) && !SYNONYM.test(path))
            .flatMap(({ path }) => unsuffixedImplementations(root, path)),
    ].toSorted(byPosition);
}
