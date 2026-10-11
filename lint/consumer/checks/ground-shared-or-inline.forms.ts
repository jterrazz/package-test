import { GROUND_EXPECTED, GROUND_REQUESTS } from '@jterrazz/typescript/rules';
import { dirname, extname, relative } from 'node:path';

import { dedent } from '../../kit/project/dedent.js';
import { parsedJson } from '../../kit/project/json-shape.js';

/** A role absent here is never written in place. */
export const INLINE_CAPS: Readonly<Record<string, number>> = {
    [GROUND_EXPECTED]: 150,
    [GROUND_REQUESTS]: 30,
};

export const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/u;

export function written(file: string, target: string): string {
    // Stryker disable next-line StringLiteral: a POSIX path holds no backslash to rejoin
    return relative(dirname(file), target).split('\\').join('/');
}

/** Its closing newline is no line of its own. */
export function valueLines(text: string): number {
    // Stryker disable next-line StringLiteral: a trailing newline replaced by any text on its line adds no line
    return text.replace(/\n$/u, '').split('\n').length;
}

export const JSON_SUBJECT =
    /\.(?:head|json|jsonLd|screen|value)\s*\)\s*\.(?:not\s*\.)?toMatch\s*\($/u;

function escapeTemplate(text: string): string {
    return text
        .replaceAll('\\', String.raw`\\`)
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${');
}

function templated(text: string, indent: string): { body: string; closing: string } {
    const lines = text.split('\n');
    const inner = `${indent}    `;
    const last = lines.pop() ?? '';
    const body = lines.map((line) => (line === '' ? '' : `${inner}${line}`)).join('\n');
    return { body, closing: last === '' ? indent : `${inner}${last}` };
}

/** Whether a literal written in place compares equal to `text` once the comparison's dedent read it: the template form, or else the quoted one. */
export function survivesInPlace(text: string): boolean {
    const { body, closing } = templated(text, '');
    return dedent(`\n${body}\n${closing}`) === text || dedent(text) === text;
}

function block(text: string, indent: string): string {
    if (!text.includes('\n')) {
        return `\`${escapeTemplate(text)}\``;
    }
    const { body, closing } = templated(text, indent);
    // invariant: the literal is read back through the runtime's own dedent: a candidate that does not come back unchanged is written as one quoted line.
    return dedent(`\n${body}\n${closing}`) === text
        ? `\`\n${escapeTemplate(body)}\n${escapeTemplate(closing)}\``
        : JSON.stringify(text);
}

export function value(parsed: unknown, indent: string): string {
    return (JSON.stringify(parsed, null, 4) ?? 'null').split('\n').join(`\n${indent}`);
}

const NO_JSON = Symbol('no JSON');

export function jsonOf(text: string): unknown {
    const parsed = parsedJson(text, NO_JSON);
    return parsed === NO_JSON ? undefined : parsed;
}

// invariant: `{ frozen: true }` is the author's statement that the bytes are the contract: a golden compared so is never moved into a literal, which would compare a structure and pin no byte.
const FROZEN = /^\s*,\s*\{[^}]*\bfrozen\s*:\s*true\b/u;

/** `undefined` for a shape the fixer does not rewrite, which the checker then does not ask for: both read this one predicate. `after` is the text that follows the file's reference. */
export function replacementOf(
    before: string,
    content: string,
    target: string,
    indent: string,
    after = '',
): string | undefined {
    if (FROZEN.test(after)) {
        return undefined;
    }
    const extension = extname(target);
    if (/\.request\s*\(\s*$/u.test(before)) {
        return block(content, indent);
    }
    if (/\.(?:post|put)\s*\([^()]*,\s*$/u.test(before)) {
        const parsed = extension === '.json' ? jsonOf(content) : undefined;
        return parsed === undefined ? JSON.stringify(content) : value(parsed, indent);
    }
    if (!/\.toMatch\s*\(\s*$/u.test(before)) {
        return undefined;
    }
    if (JSON_SUBJECT.test(before)) {
        const parsed = jsonOf(content);
        return parsed === undefined ? undefined : value(parsed, indent);
    }
    // invariant: the gate above reads `.toMatch` unspaced, so no space follows a dot here.
    return extension === '.json' && !/\)\s*\.(?:not\s*\.)?toMatch\s*\($/u.test(before)
        ? undefined
        : block(content, indent);
}
