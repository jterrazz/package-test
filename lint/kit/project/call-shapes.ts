import {
    child,
    childList,
    cookedText,
    identifierName,
    isNode,
    memberPropertyName,
    stringValue,
    walk,
} from './ast.js';
import type { AstNode } from './ast.js';
import { parseProgram } from './module-parser.js';

// invariant: a call probe is read as a shape in a closed grammar (`name(`, `.name(`, `object.name(`, then what the first argument opens on: `inner(`, `'`, `'/`, `{`, `[`; and a leading `))` for a call whose object ends on a call), so a formatter splitting a call changes nothing. A probe outside the grammar throws where it is read.

type Argument =
    | { callee: string; kind: 'call' }
    | { kind: 'any' }
    | { kind: 'array' }
    | { kind: 'object' }
    | { kind: 'string'; prefix: string };

export type CallShape = {
    argument: Argument;
    /** Any object when `.`, none for a bare call. */
    callee: { kind: 'bare'; name: string } | { kind: 'method'; name: string; object?: string };
    onACall: boolean;
};

const CALL_PROBE =
    /^(?<chain>\)\))?(?<dot>\.)?(?:(?<object>[$A-Z_a-z][\w$]*)\.)?(?<name>[$A-Z_a-z][\w$]*)\((?<argument>.*)$/u;

const INNER_CALL = /^(?<callee>[$A-Z_a-z][\w$]*)\($/u;

function argumentOf(text: string, probe: string): Argument {
    if (text === '') {
        return { kind: 'any' };
    }
    if (text === '{') {
        return { kind: 'object' };
    }
    if (text === '[') {
        return { kind: 'array' };
    }
    if (text.startsWith("'") || text.startsWith('"')) {
        return { kind: 'string', prefix: text.slice(1) };
    }
    // Stryker disable next-line OptionalChaining: a match always carries its named group
    const inner = INNER_CALL.exec(text)?.groups?.callee;
    if (inner !== undefined) {
        return { callee: inner, kind: 'call' };
    }
    throw new Error(`capability probe ${probe}: no call shape reads the argument \`${text}\``);
}

/** `undefined` when the probe is no call (a key, an accessor, a text). */
export function callShapeOf(probe: string): CallShape | undefined {
    if (!probe.includes('(')) {
        return undefined;
    }
    const match = CALL_PROBE.exec(probe);
    if (match === null) {
        throw new Error(`capability probe ${probe}: outside the call grammar`);
    }
    // Stryker disable next-line StringLiteral: a matched probe always names its call and its argument, if empty
    const { argument = '', chain, dot, name = '', object } = match.groups ?? {};
    return {
        argument: argumentOf(argument, probe),
        callee:
            dot !== undefined || object !== undefined
                ? { kind: 'method', name, ...(object === undefined ? {} : { object }) }
                : { kind: 'bare', name },
        onACall: chain !== undefined,
    };
}

export function callsOf(filename: string, source: string): AstNode[] {
    const program = parseProgram(filename, source);
    const calls: AstNode[] = [];
    // Stryker disable next-line ConditionalExpression: a source the parser refuses walks as no call
    if (isNode(program)) {
        walk(program, (node) => {
            if (node.type === 'CallExpression') {
                calls.push(node);
            }
        });
    }
    return calls;
}

// invariant: a template is read by the text before its first hole: `/users/${id}` opens on `/users/`.
function openingOf(node: AstNode): string | undefined {
    if (node.type === 'TemplateLiteral') {
        const [first] = childList(node, 'quasis');
        return cookedText(first);
    }
    return stringValue(node);
}

const TRANSPARENT = new Set([
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
    'TSTypeAssertion',
]);

function unwrapped(node: AstNode | undefined): AstNode | undefined {
    return node !== undefined && TRANSPARENT.has(node.type)
        ? unwrapped(child(node, 'expression'))
        : node;
}

function argumentMatches(call: AstNode, argument: Argument): boolean {
    if (argument.kind === 'any') {
        return true;
    }
    const [written] = childList(call, 'arguments');
    const first = unwrapped(written);
    if (first === undefined) {
        return false;
    }
    if (argument.kind === 'call') {
        return (
            first.type === 'CallExpression' &&
            identifierName(child(first, 'callee')) === argument.callee
        );
    }
    if (argument.kind === 'string') {
        return openingOf(first)?.startsWith(argument.prefix) === true;
    }
    return first.type === (argument.kind === 'object' ? 'ObjectExpression' : 'ArrayExpression');
}

// invariant: only a call has arguments to end on.
function wrapsACall(node: AstNode | undefined): boolean {
    return unwrapped(childList(node, 'arguments').at(-1))?.type === 'CallExpression';
}

export function isCallOf(call: AstNode, shape: CallShape): boolean {
    const callee = child(call, 'callee');
    if (shape.callee.kind === 'bare') {
        return (
            identifierName(callee) === shape.callee.name && argumentMatches(call, shape.argument)
        );
    }
    if (memberPropertyName(callee) !== shape.callee.name) {
        return false;
    }
    const object = child(callee, 'object');
    if (shape.callee.object !== undefined && identifierName(object) !== shape.callee.object) {
        return false;
    }
    if (shape.onACall && !wrapsACall(object)) {
        return false;
    }
    return argumentMatches(call, shape.argument);
}
