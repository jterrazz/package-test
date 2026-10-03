import { blankComments } from '@jterrazz/typescript/rules';
import { existsSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import { closingOf, literalEnd } from '../../kit/project/source-scan.js';
import { lineEnd, withLeadingComments } from '../../kit/project/spec-subjects.js';
import type { Span } from '../../kit/project/spec-subjects.js';

type ImportClause = Span & {
    defaultName: string | undefined;
    named: { local: string; text: string }[];
    source: string;
    typeOnly: boolean;
};

const IMPORT =
    /^import\s+(?<type>type\s+)?(?:(?<plain>[\w$]+)\s*,?\s*)?(?:\{(?<named>[^}]*)\})?\s*from\s+(?<quote>['"])(?<source>[^'"]+)\k<quote>;?[ \t]*\n?/gmu;

export function importsOf(text: string): ImportClause[] {
    return [...text.matchAll(IMPORT)].map((found) => ({
        defaultName: found.groups?.plain,
        end: found.index + found[0].length,
        named: (found.groups?.named ?? '')
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry !== '')
            .map((entry) => ({
                local: (entry.split(/\s+as\s+/u).at(-1) ?? entry).replace(/^type\s+/u, ''),
                text: entry,
            })),
        source: found.groups?.source ?? '',
        start: found.index,
        typeOnly: found.groups?.type !== undefined,
    }));
}

function importText(clause: ImportClause, keeps: (local: string) => boolean): string {
    const plain =
        clause.defaultName !== undefined && keeps(clause.defaultName)
            ? clause.defaultName
            : undefined;
    const named = clause.named.filter((name) => keeps(name.local)).map((name) => name.text);
    const parts = [plain, named.length === 0 ? undefined : `{ ${named.join(', ')} }`].filter(
        (part) => part !== undefined,
    );
    return parts.length === 0
        ? ''
        : `import ${clause.typeOnly ? 'type ' : ''}${parts.join(', ')} from '${clause.source}';\n`;
}

/** A name written in a message is no read of it; a template stays whole, since its holes hold code. */
export function codeOnly(text: string): string {
    const blank = blankComments(text);
    let out = '';
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            out += blank[index] ?? '';
            index += 1;
            continue;
        }
        const literal = blank.slice(index, end);
        out += literal.startsWith('`') ? literal : literal.replaceAll(/[^\n]/gu, ' ');
        index = end;
    }
    return out;
}

export function isRead(text: string, name: string, declared: Span): boolean {
    const body = codeOnly(`${text.slice(0, declared.start)}\n${text.slice(declared.end)}`);
    return new RegExp(
        String.raw`(?<![\w$])(?<!(?<!\.\.)\.)${name.replaceAll('$', String.raw`\$`)}(?![\w$])`,
        'u',
    ).test(body);
}

export type Declaration = Span & { name: string; type: boolean };

const DECLARATION =
    /^(?:(?:const|let)\s+(?<variable>[\w$]+)|(?:async\s+)?function\s*\*?\s*(?<fn>[\w$]+)|type\s+(?<alias>[\w$]+)|interface\s+(?<shape>[\w$]+))/gmu;

function statementEnd(blank: string, start: number, isFunction: boolean): number {
    let index = start;
    while (index < blank.length) {
        const character = blank[index] ?? '';
        const past = literalEnd(blank, index);
        if (past !== index) {
            index = past;
            continue;
        }
        if (character === '(' || character === '[' || character === '{') {
            const close = closingOf(blank, index);
            // invariant: an object type in a return annotation is followed by more of the head.
            if (
                isFunction &&
                character === '{' &&
                /^[ \t]*(?:\n|$)/u.test(blank.slice(close + 1))
            ) {
                return close + 1;
            }
            index = close + 1;
            continue;
        }
        if (character === ';') {
            return index + 1;
        }
        index += 1;
    }
    return blank.length;
}

/** An export is read elsewhere, and kept. */
export function declarationsOf(text: string): Declaration[] {
    const blank = blankComments(text);
    return [...blank.matchAll(DECLARATION)].flatMap((match) => {
        const { alias, fn, shape, variable } = match.groups ?? {};
        const name = variable ?? fn ?? alias ?? shape;
        if (name === undefined) {
            return [];
        }
        const end = statementEnd(
            blank,
            match.index + match[0].length,
            fn !== undefined || shape !== undefined,
        );
        return [
            {
                end: lineEnd(text, end - 1),
                name,
                start: withLeadingComments(text, match.index),
                type: alias !== undefined || shape !== undefined,
            },
        ];
    });
}

function withoutAnUnreadDeclaration(text: string): string {
    const unread = declarationsOf(text).find(
        (declaration) => !isRead(text, declaration.name, declaration),
    );
    return unread === undefined ? text : text.slice(0, unread.start) + text.slice(unread.end);
}

function withImportsPruned(text: string): string {
    const clauses = importsOf(text);
    // invariant: a name another import clause spells (`{ cli as vitestCli }`) is no read of it.
    const code = clauses
        .toReversed()
        .reduce((rest, clause) => rest.slice(0, clause.start) + rest.slice(clause.end), text);
    let current = text;
    for (const clause of clauses.toReversed()) {
        const kept = importText(clause, (local) => isRead(code, local, { end: 0, start: 0 }));
        current = current.slice(0, clause.start) + kept + current.slice(clause.end);
    }
    return current;
}

export function pruned(text: string): string {
    let current = text;
    for (let previous = ''; previous !== current;) {
        previous = current;
        current = withoutAnUnreadDeclaration(current);
    }
    return withImportsPruned(current)
        .replaceAll(/\n{3,}/gu, '\n\n')
        .replace(/(?:\n[ \t]*\/\/[^\n]*|\n[ \t]*)+$/u, '\n');
}

export function relativePath(from: string, to: string): string {
    const path = relative(from, to).split(sep).join('/');
    return path.startsWith('.') ? path : `./${path}`;
}

export const RELATIVE_LITERAL =
    /(?<lead>(?<![.\w])(?:file|directory)\(\s*|\bfrom\s+|\bimport\(\s*|import\.meta\.dirname,\s*)(?<quote>['"])(?<path>\.\.?\/[^'"]*)\k<quote>/gu;

function literalSpans(text: string): Span[] {
    const blank = blankComments(text);
    const spans: Span[] = [];
    for (let index = 0; index < blank.length;) {
        const end = literalEnd(blank, index);
        if (end === index) {
            index += 1;
        } else {
            spans.push({ end, start: index });
            index = end;
        }
    }
    return spans;
}

/** A path naming nothing, a negative spec's missing file, says the same from anywhere. */
export function rebased(text: string, from: string, to: string): string {
    const strings = literalSpans(text);
    let out = '';
    let last = 0;
    for (const found of text.matchAll(RELATIVE_LITERAL)) {
        const { lead = '', path = '', quote = "'" } = found.groups ?? {};
        const target = resolve(from, path);
        const inText = strings.some((span) => found.index > span.start && found.index < span.end);
        const isModule = /^(?:from|import)\b/u.test(lead);
        if (inText || (!isModule && !existsSync(target))) {
            continue;
        }
        const next =
            relativePath(to, target) + (path.endsWith('/') && !path.endsWith('../') ? '/' : '');
        out += `${text.slice(last, found.index)}${lead}${quote}${next.replace(/\/\/$/u, '/')}${quote}`;
        last = found.index + found[0].length;
    }
    return out + text.slice(last);
}

export function without(text: string, spans: Span[]): string {
    let current = text;
    for (const span of spans.toSorted((a, b) => b.start - a.start)) {
        current = current.slice(0, span.start) + current.slice(span.end);
    }
    return current;
}
