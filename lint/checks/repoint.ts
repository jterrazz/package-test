import { writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { documentPaths, parseSpecDocument } from '../../src/facets/cli/documents/spec-document.js';
import { isRelativePath } from '../../src/kernel/files/spec-path.js';
import { moduleTestsOf } from '../reading/module-tests.js';
import { literalSpans } from '../reading/spec-values.js';
import { blankComments, isWithin, readText } from './tree.js';

function pathFrom(from: string, to: string): string {
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
    return path.endsWith('/') && !moved.endsWith('/') ? `${moved}/` : moved;
}

export function relativeLiterals(text: string): { end: number; start: number; value: string }[] {
    const scanned = blankComments(text);
    return literalSpans(scanned).flatMap(({ end, start }) => {
        const value = scanned.slice(start + 1, end - 1);
        const quoted = `'"\``.includes(scanned[start] ?? '') && !value.includes('${');
        return quoted && isRelativePath(value) ? [{ end, start, value }] : [];
    });
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
        if (moved === undefined || lines[at] === undefined) {
            continue;
        }
        const escaped = path.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
        lines[at] = lines[at].replace(
            new RegExp(String.raw`(^|[\s'"[,])${escaped}(?=$|[\s'"\],])`, 'u'),
            (_whole, lead: string) => `${lead}${moved}`,
        );
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
