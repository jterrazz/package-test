import { isRecord } from '../../../lint/kit/project/json-shape.js';
import { CaptureScope } from '../../expectations/tokens/capture-scope.js';
import type { Matcher } from '../../expectations/tokens/match.js';
import { structuralEquals } from '../../expectations/tokens/structural.js';

/** A text filter on a provider request builder: a string is exact, a `RegExp` or `match.*` loosens it. */
export type TextFilter = Matcher | RegExp | string;

export function matchesText(filter: TextFilter | undefined, actual: string): boolean {
    if (filter === undefined) {
        return true;
    }
    if (typeof filter === 'string') {
        return actual === filter;
    }
    if (filter instanceof RegExp) {
        return filter.test(actual);
    }
    // invariant: a code matcher: the one structural comparison every assertion makes.
    return structuralEquals(filter, actual, new CaptureScope());
}

/** A field of a request body read as JSON: absent wherever the body is not an object holding it. */
export function fieldOf(value: unknown, key: string): unknown {
    return isRecord(value) ? value[key] : undefined;
}

// Stryker disable next-line ArrayDeclaration: no request holds a message or a tool of the text a mutant writes
export const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

export const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The content of the first message of `role`, as text: a structured content is its JSON. */
export function messageText(messages: unknown, role: string): string {
    const content = fieldOf(
        listOf(messages).find((message) => fieldOf(message, 'role') === role),
        'content',
    );
    return content === undefined || typeof content === 'string'
        ? textOf(content)
        : JSON.stringify(content);
}

export const namesOf = (tools: unknown, read: (tool: unknown) => unknown): string[] =>
    listOf(tools)
        .map((tool) => textOf(read(tool)))
        .filter((name) => name !== '');
