import { blankComments } from '@jterrazz/typescript/rules';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { pathFrom } from '../../kit/checker/repoint.js';
import { closingOf, literalEnd } from '../../kit/project/source-scan.js';
import { lineEnd, withLeadingComments } from '../../kit/project/spec-subjects.js';
import type { Span } from '../../kit/project/spec-subjects.js';
import { literalSpans } from '../../kit/project/spec-values.js';

type ImportClause = Span & {
    defaultName: string | undefined;
    named: { local: string; text: string }[];
    source: string;
    typeOnly: boolean;
};

const IMPORT =
    /^import\s+(?<type>type\s+)?(?:(?<plain>[\w$]+)\s*,?\s*)?(?:\{(?<named>[^}]*)\})?\s*from\s+(?<quote>['"])(?<source>[^'"]+)\k<quote>;?[ \t]*\n?/gmu;

/** An import names a single space-separated alias, so every spelling of the split reads it alike. */
export function importsOf(text: string): ImportClause[] {
    // Stryker disable OptionalChaining,Regex,UnaryOperator: a match carries its named groups, and an alias is one word after one `as`
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
    // Stryker restore OptionalChaining,Regex,UnaryOperator
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

// invariant: an import of the setup module is written as the spec writes its own relative imports: `.js`, or bare when any of them is (a profile refusing extensions).
export function moduleExtensionOf(text: string): string {
    const relative = importsOf(text).filter(({ source }) => /^\.\.?\//u.test(source));
    return relative.some(({ source }) => !/\.[cm]?js$/u.test(source)) ? '' : '.js';
}

/** A name written in a message is no read of it; a template stays whole, since its holes hold code. */
export function codeOnly(text: string): string {
    const blank = blankComments(text);
    return literalSpans(blank)
        .filter(({ start }) => blank[start] !== '`')
        .reduce(
            (out, { end, start }) =>
                out.slice(0, start) +
                out.slice(start, end).replaceAll(/[^\n]/gu, ' ') +
                out.slice(end),
            blank,
        );
}

export function isReadIn(text: string, name: string): boolean {
    const written = String.raw`(?<![\w$])(?<!(?<!\.\.)\.)${name.replaceAll('$', String.raw`\$`)}(?![\w$])`;
    // Stryker disable next-line StringLiteral: a name is plain ASCII, read alike with the unicode flag or without
    return new RegExp(written, 'u').test(codeOnly(text));
}

export function isRead(text: string, name: string, declared: Span): boolean {
    return isReadIn(`${text.slice(0, declared.start)}\n${text.slice(declared.end)}`, name);
}

export type Declaration = Span & { name: string; type: boolean };

const DECLARATION =
    /^(?:(?:const|let)\s+(?<variable>[\w$]+)|(?:async\s+)?function\s*\*?\s*(?<fn>[\w$]+)|type\s+(?<alias>[\w$]+)|interface\s+(?<shape>[\w$]+))/gmu;

// outside: a body closing at the end of its line ends the statement: oxfmt closes every other braced value with `;` or `,`.
function statementEnd(blank: string, start: number): number {
    let index = start;
    // Stryker disable next-line EqualityOperator: past the text's end no character opens a bracket or ends a statement
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
            if (character === '{' && /^[ \t]*(?:\n|$)/u.test(blank.slice(close + 1))) {
                return close + 1;
            }
            index = close + 1;
            continue;
        }
        if (character === ';') {
            // Stryker disable next-line ArithmeticOperator: the statement is cut to its line's end either way
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
        // Stryker disable next-line ConditionalExpression,BlockStatement: every alternative of the pattern names its declaration
        if (name === undefined) {
            return [];
        }
        const end = statementEnd(blank, match.index + match[0].length);
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
        const kept = importText(clause, (local) => isReadIn(code, local));
        current = current.slice(0, clause.start) + kept + current.slice(clause.end);
    }
    return current;
}

function withoutUnreadDeclarations(text: string): string {
    const next = withoutAnUnreadDeclaration(text);
    return next === text ? text : withoutUnreadDeclarations(next);
}

export function pruned(text: string): string {
    return withImportsPruned(withoutUnreadDeclarations(text))
        .replaceAll(/\n{3,}/gu, '\n\n')
        .replace(/(?:\n[ \t]*\/\/[^\n]*|\n[ \t]*)+$/u, '\n');
}

export const RELATIVE_LITERAL =
    /(?<lead>(?<![.\w])(?:file|directory)\(\s*|\bfrom\s+|\bimport\(\s*|import\.meta\.dirname,\s*)(?<quote>['"])(?<path>\.\.?\/[^'"]*)\k<quote>/gu;

// invariant: `from '…'` and `import('…')` name a module; every other lead names a path on disk.
function isModuleLead(lead: string): boolean {
    return /^(?:from\b|import\()/u.test(lead);
}

/** A path naming nothing, a negative spec's missing file, says the same from anywhere. */
export function rebased(text: string, from: string, to: string): string {
    const strings = literalSpans(blankComments(text));
    let out = '';
    let last = 0;
    for (const found of text.matchAll(RELATIVE_LITERAL)) {
        const { lead = '', path = '', quote = "'" } = found.groups ?? {};
        const target = resolve(from, path);
        // Stryker disable next-line EqualityOperator: a call's lead never starts nor ends a literal
        const inText = strings.some((span) => found.index > span.start && found.index < span.end);
        const isModule = isModuleLead(lead);
        if (inText || (!isModule && !existsSync(target))) {
            continue;
        }
        const next =
            pathFrom(to, target) + (path.endsWith('/') && !path.endsWith('../') ? '/' : '');
        out += `${text.slice(last, found.index)}${lead}${quote}${next}${quote}`;
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
