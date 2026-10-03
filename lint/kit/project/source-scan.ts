export const HOLE = '\u0000';

export function skipString(text: string, start: number): number {
    const quote = text[start];
    let index = start + 1;
    while (index < text.length) {
        const character = text[index];
        if (character === '\\') {
            index += 2;
            continue;
        }
        if (character === quote) {
            return index + 1;
        }
        if (quote === '`' && character === '$' && text[index + 1] === '{') {
            index = closingOf(text, index + 1) + 1;
            continue;
        }
        index += 1;
    }
    return index;
}

const BEFORE_REGEX = /(?:^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof|\bcase)\s*$/u;

function opensRegex(text: string, start: number): boolean {
    return (
        text[start] === '/' &&
        text[start + 1] !== '/' &&
        text[start + 1] !== '*' &&
        BEFORE_REGEX.test(text.slice(Math.max(0, start - 16), start))
    );
}

function pastFlags(text: string, close: number): number {
    let end = close + 1;
    while (/[a-z]/u.test(text[end] ?? '')) {
        end += 1;
    }
    return end;
}

function regexEnd(text: string, start: number): number {
    if (!opensRegex(text, start)) {
        return start;
    }
    let inClass = false;
    for (let index = start + 1; index < text.length; index += 1) {
        const character = text[index];
        if (character === '\\') {
            index += 1;
        } else if (character === '\n') {
            return start;
        } else if (character === '[' || character === ']') {
            inClass = character === '[';
        } else if (character === '/' && !inClass) {
            return pastFlags(text, index);
        }
    }
    return start;
}

export function literalEnd(text: string, start: number): number {
    const character = text[start];
    if (character === "'" || character === '"' || character === '`') {
        return skipString(text, start);
    }
    return regexEnd(text, start);
}

export function closingOf(text: string, open: number): number {
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const stack: string[] = [];
    let index = open;
    while (index < text.length) {
        const character = text[index] ?? '';
        const past = index === open ? index : literalEnd(text, index);
        if (past !== index) {
            index = past;
            continue;
        }
        if (character in pairs) {
            stack.push(pairs[character] ?? '');
        } else if (character === stack.at(-1)) {
            stack.pop();
            if (stack.length === 0) {
                return index;
            }
        }
        index += 1;
    }
    return text.length;
}

export function argumentsOf(text: string): string[] {
    const parts: string[] = [];
    let start = 0;
    let index = 0;
    while (index < text.length) {
        const character = text[index] ?? '';
        const past = literalEnd(text, index);
        if (past !== index) {
            index = past;
            continue;
        }
        if (character === '(' || character === '[' || character === '{') {
            index = closingOf(text, index) + 1;
            continue;
        }
        if (character === ',') {
            parts.push(text.slice(start, index).trim());
            start = index + 1;
        }
        index += 1;
    }
    const last = text.slice(start).trim();
    return last === '' ? parts : [...parts, last];
}

export function literalOf(argument: string | undefined): string | undefined {
    const text = argument?.trim() ?? '';
    const quote = text[0];
    if ((quote !== "'" && quote !== '"' && quote !== '`') || skipString(text, 0) !== text.length) {
        return undefined;
    }
    const body = text.slice(1, -1);
    return quote === '`' ? body.replaceAll(/\$\{[^}]*\}/gu, HOLE) : body;
}
