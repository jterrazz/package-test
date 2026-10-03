export const HOLE = '\u0000';

export function skipString(text: string, start: number): number {
    const quote = text[start];
    let index = start + 1;
    // Stryker disable next-line EqualityOperator: past the text's end there is no character to read
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
            // Stryker disable next-line ArithmeticOperator: closingOf read from the `$` steps over it to the same `{`
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
    // Stryker disable next-line EqualityOperator: past the text's end there is no character to read
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
    // Stryker disable next-line EqualityOperator: past the text's end there is no character to read
    while (index < text.length) {
        const character = text[index] ?? '';
        // Stryker disable next-line ConditionalExpression: the opening is a bracket, which opens no literal
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
    // Stryker disable next-line EqualityOperator: past the text's end there is no character to read
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
    // Stryker disable next-line StringLiteral: no argument opens on no quote either way
    const text = argument?.trim() ?? '';
    const quote = text[0];
    if ((quote !== "'" && quote !== '"' && quote !== '`') || skipString(text, 0) !== text.length) {
        return undefined;
    }
    const body = text.slice(1, -1);
    return quote === '`' ? body.replaceAll(/\$\{[^}]*\}/gu, HOLE) : body;
}

const QUOTES = new Set(['"', "'", '`']);

function pastComment(source: string, index: number): number | undefined {
    const pair = source.slice(index, index + 2);
    if (pair === '//' && source[index - 1] !== ':') {
        const end = source.indexOf('\n', index);
        return end === -1 ? source.length : end;
    }
    if (pair === '/*') {
        const end = source.indexOf('*/', index + 2);
        return end === -1 ? source.length : end + 2;
    }
    return undefined;
}

function pastString(source: string, index: number): number {
    const quote = source[index];
    let at = index + 1;
    // Stryker disable next-line EqualityOperator: past the text's end there is no character to read
    while (at < source.length && source[at] !== quote) {
        at += source[at] === '\\' ? 2 : 1;
    }
    return Math.min(at + 1, source.length);
}

/** Scanned character by character: a regex cannot tell a comment from a string that spells one (`'specs/lint/*' + '/*.spec.yaml'`). */
export function withoutComments(source: string): string {
    let out = '';
    let index = 0;
    // Stryker disable next-line EqualityOperator: past the text's end there is no character to read
    while (index < source.length) {
        const char = source[index] ?? '';
        const skipped = pastComment(source, index);
        if (skipped !== undefined) {
            index = skipped;
        } else if (QUOTES.has(char)) {
            const end = pastString(source, index);
            out += source.slice(index, end);
            index = end;
        } else {
            out += char;
            index += 1;
        }
    }
    return out;
}

/** Per character: whether it sits inside a string literal. */
export function stringsOf(source: string): boolean[] {
    // Stryker disable next-line ArrayDeclaration: every offset is written below
    const inside: boolean[] = [];
    let quote = '';
    for (let index = 0; index < source.length; index += 1) {
        const char = source[index] ?? '';
        if (quote === '') {
            quote = char === '"' || char === "'" || char === '`' ? char : '';
            inside[index] = quote !== '';
        } else {
            inside[index] = true;
            if (char === '\\') {
                index += 1;
                inside[index] = true;
            } else if (char === quote) {
                quote = '';
            }
        }
    }
    return inside;
}
