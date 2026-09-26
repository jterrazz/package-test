/**
 * The NSPredicate subset an `-ios predicate string:` selector is written in,
 * read the way XCUITest reads it: comparisons (`==`, `CONTAINS`, `IN`) of an
 * element attribute against a quoted string, a number or a `{…}` set, joined
 * by `AND`/`OR` and grouped by parentheses. Anything else refuses as an
 * invalid selector, so a selector the real driver would reject never passes
 * here.
 */

import { InvalidSelectorError } from './invalid-selector-error.js';

export type Attributes = Record<string, string | undefined>;

export type Predicate = (attributes: Attributes) => boolean;

type Token =
    | { kind: 'number'; text: string }
    | { kind: 'punct'; text: string }
    | { kind: 'string'; text: string }
    | { kind: 'word'; text: string };

const WORD = /[A-Za-z_]/u;
const DIGIT = /\d/u;

function readString(source: string, start: number): { end: number; text: string } {
    let text = '';
    let index = start + 1;
    while (index < source.length && source[index] !== "'") {
        if (source[index] === '\\') {
            index += 1;
        }
        text += source[index] ?? '';
        index += 1;
    }
    if (index >= source.length) {
        throw new InvalidSelectorError(`unterminated string in predicate: ${source}`);
    }
    return { end: index + 1, text };
}

function readRun(source: string, start: number, pattern: RegExp): number {
    let index = start;
    while (index < source.length && pattern.test(source[index] ?? '')) {
        index += 1;
    }
    return index;
}

function tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let index = 0;
    while (index < source.length) {
        const char = source[index] ?? '';
        if (char === ' ') {
            index += 1;
        } else if (char === "'") {
            const read = readString(source, index);
            tokens.push({ kind: 'string', text: read.text });
            index = read.end;
        } else if (source.startsWith('==', index)) {
            tokens.push({ kind: 'punct', text: '==' });
            index += 2;
        } else if ('(){},'.includes(char)) {
            tokens.push({ kind: 'punct', text: char });
            index += 1;
        } else if (DIGIT.test(char)) {
            const end = readRun(source, index, DIGIT);
            tokens.push({ kind: 'number', text: source.slice(index, end) });
            index = end;
        } else if (WORD.test(char)) {
            const end = readRun(source, index, /\w/u);
            tokens.push({ kind: 'word', text: source.slice(index, end) });
            index = end;
        } else {
            throw new InvalidSelectorError(`unexpected '${char}' in predicate: ${source}`);
        }
    }
    return tokens;
}

class Parser {
    private index = 0;

    private readonly source: string;

    private readonly tokens: Token[];

    constructor(tokens: Token[], source: string) {
        this.tokens = tokens;
        this.source = source;
    }

    parse(): Predicate {
        const predicate = this.or();
        if (this.index !== this.tokens.length) {
            throw this.invalid();
        }
        return predicate;
    }

    private and(): Predicate {
        const operands = [this.primary()];
        while (this.peekWord('AND')) {
            this.index += 1;
            operands.push(this.primary());
        }
        return (attributes) => operands.every((operand) => operand(attributes));
    }

    private comparison(): Predicate {
        const left = this.operand();
        const operator = this.tokens[this.index];
        this.index += 1;
        if (operator?.text === 'IN') {
            const set = this.set();
            return (attributes) => set.includes(left(attributes) ?? '');
        }
        const right = this.operand();
        if (operator?.text === '==') {
            return (attributes) => left(attributes) === right(attributes);
        }
        if (operator?.text === 'CONTAINS') {
            return (attributes) => (left(attributes) ?? '').includes(right(attributes) ?? '');
        }
        throw this.invalid();
    }

    private invalid(): InvalidSelectorError {
        return new InvalidSelectorError(`invalid predicate: ${this.source}`);
    }

    private operand(): (attributes: Attributes) => string | undefined {
        const token = this.tokens[this.index];
        this.index += 1;
        if (token?.kind === 'string' || token?.kind === 'number') {
            return () => token.text;
        }
        if (token?.kind === 'word') {
            return (attributes) => attributes[token.text];
        }
        throw this.invalid();
    }

    private or(): Predicate {
        const operands = [this.and()];
        while (this.peekWord('OR')) {
            this.index += 1;
            operands.push(this.and());
        }
        return (attributes) => operands.some((operand) => operand(attributes));
    }

    private peekWord(word: string): boolean {
        const token = this.tokens[this.index];
        return token?.kind === 'word' && token.text === word;
    }

    private primary(): Predicate {
        if (this.tokens[this.index]?.text === '(') {
            this.index += 1;
            const inner = this.or();
            this.expect(')');
            return inner;
        }
        return this.comparison();
    }

    private set(): string[] {
        this.expect('{');
        const members: string[] = [];
        for (;;) {
            const token = this.tokens[this.index];
            if (token?.kind !== 'string') {
                throw this.invalid();
            }
            members.push(token.text);
            this.index += 1;
            if (this.tokens[this.index]?.text !== ',') {
                break;
            }
            this.index += 1;
        }
        this.expect('}');
        return members;
    }

    private expect(text: string): void {
        if (this.tokens[this.index]?.text !== text) {
            throw this.invalid();
        }
        this.index += 1;
    }
}

export function compilePredicate(source: string): Predicate {
    return new Parser(tokenize(source), source).parse();
}
