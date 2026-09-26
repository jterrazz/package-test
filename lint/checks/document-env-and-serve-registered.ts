import { dirname, join } from 'node:path';

import type { SpecDocument } from '../../src/facets/cli/documents/spec-document.js';
import { treeNames } from '../../src/kernel/files/git-tree.js';
import { finding, readText } from './document-model.js';
import type { DocumentFinding } from './document-model.js';

/** Read by depth, not by parsing. */
function objectKeys(source: string, from: number): { end: number; keys: string[] } {
    const keys: string[] = [];
    let depth = 0;
    let quote = '';
    for (let index = from; index < source.length; index += 1) {
        const char = source[index] ?? '';
        if (quote !== '') {
            if (char === quote && source[index - 1] !== '\\') {
                quote = '';
            }
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{' || char === '[' || char === '(') {
            depth += 1;
            continue;
        }
        if (char === '}' || char === ']' || char === ')') {
            depth -= 1;
            if (depth === 0) {
                return { end: index, keys };
            }
            continue;
        }
        if (depth === 1 && /[A-Za-z_$'"]/u.test(char)) {
            const rest = /^(?<quote>['"]?)(?<name>[A-Za-z_$][\w$]*)\k<quote>\s*:/u.exec(
                source.slice(index),
            );
            const name = rest?.groups?.name;
            if (rest !== null && name !== undefined) {
                keys.push(name);
                index += rest[0].length - 1;
            }
        }
    }
    return { end: source.length, keys };
}

/** Nothing in a document says which neighbouring runner runs it, so their registries are read as a union. */
function registeredNames(dir: string): null | { env: Set<string>; serve: Set<string> } {
    let current = dir;
    for (;;) {
        let entries: string[];
        try {
            entries = treeNames(current).filter((name) => name.endsWith('.specification.ts'));
        } catch {
            entries = [];
        }
        if (entries.length > 0) {
            const env = new Set<string>();
            const serve = new Set<string>();
            for (const entry of entries) {
                const text = readText(join(current, entry));
                for (const call of text.matchAll(/specification\.cli\s*\(/gu)) {
                    const open = text.indexOf('{', call.index + call[0].length);
                    if (open === -1) {
                        continue;
                    }
                    const options = objectKeys(text, open);
                    for (const [key, into] of [
                        ['env', env],
                        ['serve', serve],
                    ] as const) {
                        const marker = new RegExp(String.raw`\b${key}\s*:\s*\{`, 'u').exec(
                            text.slice(open, options.end),
                        );
                        if (marker === null) {
                            continue;
                        }
                        const at = open + marker.index + marker[0].length - 1;
                        for (const name of objectKeys(text, at).keys) {
                            into.add(name);
                        }
                    }
                }
            }
            return { env, serve };
        }
        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

export function checkDocumentEnvAndServeRegistered(
    document: SpecDocument,
    dir: string,
): DocumentFinding[] {
    if (document.env.length === 0 && document.serve.length === 0) {
        return [];
    }
    const registered = registeredNames(dir);
    if (registered === null) {
        return [];
    }
    const findings: DocumentFinding[] = [];
    for (const token of document.env) {
        if (token.kind === 'set' && !registered.env.has(token.name)) {
            findings.push(
                finding('document-env-and-serve-registered', token.line, {
                    fix:
                        registered.env.size === 0
                            ? `register "${token.name}" in the \`env\` option of \`specification.cli(…)\`, or write the variable as \`NAME=value\``
                            : `name one of ${[...registered.env].sort().join(', ')}, or register "${token.name}" in \`specification.cli({ env })\``,
                    found: `env: "${token.name}", which no specification registers`,
                }),
            );
        }
    }
    for (const entry of document.serve) {
        if (!registered.serve.has(entry.name)) {
            findings.push(
                finding('document-env-and-serve-registered', entry.line, {
                    fix:
                        registered.serve.size === 0
                            ? `register "${entry.name}" in the \`serve\` option of \`specification.cli(…)\``
                            : `name one of ${[...registered.serve].sort().join(', ')}, or register "${entry.name}" in \`specification.cli({ serve })\``,
                    found: `serve: "${entry.name}", which no specification registers`,
                }),
            );
        }
    }
    return findings;
}
