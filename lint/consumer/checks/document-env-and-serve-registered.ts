import { treeNames } from '@jterrazz/typescript/rules';
import { dirname, join } from 'node:path';

import { finding } from '../../kit/project/document-model.js';
import type { SpecDocument } from '../../kit/project/spec-grammar.js';
import { readText } from '../../kit/project/tree.js';
import type { DocumentFinding } from './checker.js';

const QUOTES = new Set(["'", '"', '`']);
const OPENERS = new Set(['{', '[', '(']);
const CLOSERS = new Set(['}', ']', ')']);
const KEY = /^(?<quote>['"]?)(?<name>[A-Za-z_$][\w$]*)\k<quote>\s*:/u;

function quoteEnd(source: string, from: number): number {
    const quote = source[from];
    let index = from + 1;
    while (index < source.length && !(source[index] === quote && source[index - 1] !== '\\')) {
        index += 1;
    }
    return index;
}

/** Read by depth, not by parsing. */
function objectKeys(source: string, from: number): { end: number; keys: string[] } {
    const keys: string[] = [];
    let depth = 0;
    for (let index = from; index < source.length; index += 1) {
        const char = source[index] ?? '';
        if (QUOTES.has(char)) {
            index = quoteEnd(source, index);
        } else if (OPENERS.has(char)) {
            depth += 1;
        } else if (CLOSERS.has(char)) {
            depth -= 1;
            if (depth === 0) {
                return { end: index, keys };
            }
        } else if (depth === 1) {
            const key = KEY.exec(source.slice(index));
            if (key?.groups?.name !== undefined) {
                keys.push(key.groups.name);
                index += key[0].length - 1;
            }
        }
    }
    return { end: source.length, keys };
}

type Registered = { env: Set<string>; serve: Set<string> };

function specificationsIn(dir: string): string[] {
    try {
        return treeNames(dir).filter((name) => name.endsWith('.specification.ts'));
    } catch {
        return [];
    }
}

function optionNames(text: string, options: { end: number; open: number }, key: string): string[] {
    const marker = new RegExp(String.raw`\b${key}\s*:\s*\{`, 'u').exec(
        text.slice(options.open, options.end),
    );
    return marker === null
        ? []
        : objectKeys(text, options.open + marker.index + marker[0].length - 1).keys;
}

function registerFrom(text: string, into: Registered): void {
    for (const call of text.matchAll(/specification\.cli\s*\(/gu)) {
        const open = text.indexOf('{', call.index + call[0].length);
        if (open !== -1) {
            const options = { end: objectKeys(text, open).end, open };
            for (const name of optionNames(text, options, 'env')) {
                into.env.add(name);
            }
            for (const name of optionNames(text, options, 'serve')) {
                into.serve.add(name);
            }
        }
    }
}

/** Nothing in a document says which neighbouring runner runs it, so their registries are read as a union. */
function registeredNames(dir: string): null | Registered {
    let current = dir;
    let entries = specificationsIn(current);
    while (entries.length === 0) {
        const parent = dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
        entries = specificationsIn(current);
    }
    const registered: Registered = { env: new Set(), serve: new Set() };
    for (const entry of entries) {
        registerFrom(readText(join(current, entry)), registered);
    }
    return registered;
}

export function checkDocumentEnvAndServeRegistered(
    document: SpecDocument,
    dir: string,
): DocumentFinding[] {
    // Stryker disable ConditionalExpression,LogicalOperator,BlockStatement,ArrayDeclaration: a document naming nothing skips the walk, which would find nothing to judge
    if (document.env.length === 0 && document.serve.length === 0) {
        return [];
    }
    // Stryker restore ConditionalExpression,LogicalOperator,BlockStatement,ArrayDeclaration
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
                            : `name one of ${[...registered.env].toSorted().join(', ')}, or register "${token.name}" in \`specification.cli({ env })\``,
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
                            : `name one of ${[...registered.serve].toSorted().join(', ')}, or register "${entry.name}" in \`specification.cli({ serve })\``,
                    found: `serve: "${entry.name}", which no specification registers`,
                }),
            );
        }
    }
    return findings;
}
