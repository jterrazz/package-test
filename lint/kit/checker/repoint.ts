import { blankComments } from '@jterrazz/typescript/rules';
import { writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { moduleTestsOf } from '../project/module-tests.js';
import { isRelativePath } from '../project/relative-path.js';
import { documentPaths, parseSpecDocument } from '../project/spec-document.js';
import { literalSpans } from '../project/spec-values.js';
import { isWithin, readText } from '../project/tree.js';

export function pathFrom(from: string, to: string): string {
    const rest = relative(from, to).split(sep).join('/');
    return rest.startsWith('.') ? rest : `./${rest}`;
}

type Move = { copy: string; target: string };

export function repointed(from: string, path: string, { copy, target }: Move): string | undefined {
    const reached = resolve(from, path);
    if (reached !== copy && !isWithin(copy, reached)) {
        return undefined;
    }
    const moved = pathFrom(from, join(target, relative(copy, reached)));
    return path.endsWith('/') ? `${moved}/` : moved;
}

type QuotedLiteral = { end: number; start: number; value: string };

/** A template with a hole names no path whole. */
export function quotedLiterals(text: string): QuotedLiteral[] {
    const scanned = blankComments(text);
    return literalSpans(scanned).flatMap(({ end, start }) => {
        const value = scanned.slice(start + 1, end - 1);
        const quoted = `'"\``.includes(scanned.charAt(start)) && !value.includes('${');
        return quoted ? [{ end, start, value }] : [];
    });
}

export function relativeLiterals(text: string): QuotedLiteral[] {
    return quotedLiterals(text).filter(({ value }) => isRelativePath(value));
}

export function repointSource(file: string, move: (path: string) => string | undefined): string {
    const text = readText(file);
    let next = '';
    let last = 0;
    for (const { end, start, value } of relativeLiterals(text)) {
        const moved = move(value);
        if (moved !== undefined) {
            next += `${text.slice(last, start + 1)}${moved}`;
            last = end - 1;
        }
    }
    return `${next}${text.slice(last)}`;
}

export function repointDocument(file: string, move: (path: string) => string | undefined): string {
    const text = readText(file);
    let named;
    try {
        named = documentPaths(parseSpecDocument(text, file));
    } catch {
        return text;
    }
    const lines = text.split('\n');
    for (const { line, path } of named) {
        const moved = move(path);
        const at = line - 1;
        const original = lines[at];
        if (moved === undefined) {
            continue;
        }
        // Stryker disable next-line ConditionalExpression,BlockStatement: a parsed fixture's line is always in its text
        if (original === undefined) {
            continue;
        }
        const escaped = path.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
        const pattern = String.raw`(^|[\s'"[,])${escaped}(?=$|[\s'"\],])`;
        // Stryker disable next-line StringLiteral: a path holds no character the unicode flag reads otherwise
        const bounded = new RegExp(pattern, 'u');
        lines[at] = original.replace(bounded, (_whole, lead: string) => `${lead}${moved}`);
    }
    return lines.join('\n');
}

export function repointModuleTests(specsRoot: string, moves: readonly Move[]): string[] {
    const rewritten: string[] = [];
    for (const file of moduleTestsOf(dirname(specsRoot))) {
        const from = dirname(file);
        const text = readText(file);
        const next = repointSource(file, (path) =>
            moves.map((each) => repointed(from, path, each)).find((moved) => moved !== undefined),
        );
        if (next !== text) {
            writeFileSync(file, next);
            rewritten.push(file);
        }
    }
    return rewritten;
}
