import { dedent } from '../../../lint/kit/project/dedent.js';

function escapeTemplate(text: string): string {
    return text
        .replaceAll('\\', String.raw`\\`)
        .replaceAll('`', '\\`')
        .replaceAll('${', '\\${');
}

export function renderText(text: string, indent: string): string {
    if (!text.includes('\n')) {
        return `\`${escapeTemplate(text)}\``;
    }
    const inner = `${indent}    `;
    const lines = text.split('\n');
    const last = String(lines.pop());
    const body = lines.map((line) => (line === '' ? '' : `${inner}${line}`)).join('\n');
    const block = `\n${body}\n${last === '' ? indent : `${inner}${last}`}`;
    return dedent(block) === text ? `\`${escapeTemplate(block)}\`` : JSON.stringify(text);
}

const NUMBER_MARK = '@@in-place-number:';

const GROUPED_FROM = 10_000;

// invariant: an integer of five digits or more is written in groups of three, as the linter's numeric-separators-style spells it.
function grouped(value: unknown): unknown {
    // Stryker disable next-line ConditionalExpression: no value but a number is a safe integer; the test narrows the type the call below reads
    return typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        Math.abs(value) >= GROUPED_FROM
        ? `${NUMBER_MARK}${String(value).replaceAll(/\B(?=(?:\d{3})+$)/gu, '_')}`
        : value;
}

const MARKED = new RegExp(`"${NUMBER_MARK}(?<digits>-?[\\d_]+)"`, 'gu');

const literal = (value: unknown, space?: number): string | undefined =>
    JSON.stringify(value, (_key, item: unknown) => grouped(item), space)?.replaceAll(
        MARKED,
        '$<digits>',
    );

export function renderValue(value: unknown, indent: string): string {
    const json = literal(value, 4) ?? 'undefined';
    return json.split('\n').join(`\n${indent}`);
}

export function renderRows(rows: readonly (readonly unknown[])[], indent: string): string {
    if (rows.length === 0) {
        return '[]';
    }
    const lines = rows.map(
        (row) => `${indent}    [${row.map((cell) => literal(cell) ?? 'null').join(', ')}],`,
    );
    return `[\n${lines.join('\n')}\n${indent}]`;
}
