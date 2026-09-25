import { isNode, walk } from './ast.js';
import { parseProgram } from './module-parser.js';
import type { AstNode } from './rule-shape.js';

/**
 * The capability matrix's CALLS, read from the syntax tree.
 *
 * A row whose probe is a call — `button(`, `.seed(file(`, `.get('/`,
 * `result.table(` — is counted from the calls a file's program holds, never
 * from its letters: a formatter that breaks `.toMatch(\n directory(` across
 * lines, or a path that grows until it does, leaves the call what it was.
 * The probe is still written as the call reads, and this module reads it as
 * a SHAPE, in a closed grammar:
 *
 * - `name(` — a call of the bare identifier; `.name(` — of that method on any
 *   object; `object.name(` — of that method on that identifier;
 * - after the paren, what the first argument is: `inner(` a call of that
 *   identifier, `'` a string (`'/` one opening on `/`), `{` an object, `[` an
 *   array — nothing, any argument or none;
 * - a leading `))`: the method's object is a call whose last argument is a
 *   call — `expect(result.table('users')).toMatch([`.
 *
 * A probe outside the grammar is a declaration error, thrown where it is read.
 */

/** What a call probe asks of the first argument. */
type Argument =
    | { callee: string; kind: 'call' }
    | { kind: 'any' }
    | { kind: 'array' }
    | { kind: 'object' }
    | { kind: 'string'; prefix: string };

/** A call, as a probe describes it. */
export type CallShape = {
    argument: Argument;
    /** The method's object, when the probe names one (`result.`); any object when `.`; none for a bare call. */
    callee: { kind: 'bare'; name: string } | { kind: 'method'; name: string; object?: string };
    /** `))` — the method's object is a call whose last argument is a call. */
    onACall: boolean;
};

const CALL_PROBE =
    /^(?<chain>\)\))?(?<dot>\.)?(?:(?<object>[$A-Z_a-z][\w$]*)\.)?(?<name>[$A-Z_a-z][\w$]*)\((?<argument>.*)$/u;

const INNER_CALL = /^(?<callee>[$A-Z_a-z][\w$]*)\($/u;

/** The first argument a probe's text after the paren asks for. */
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
    const inner = INNER_CALL.exec(text)?.groups?.callee;
    if (inner !== undefined) {
        return { callee: inner, kind: 'call' };
    }
    throw new Error(`capability probe ${probe}: no call shape reads the argument \`${text}\``);
}

/** The call a probe describes — `undefined` when the probe is no call (a key, an accessor, a text). */
export function callShapeOf(probe: string): CallShape | undefined {
    if (!probe.includes('(')) {
        return undefined;
    }
    const groups = CALL_PROBE.exec(probe)?.groups;
    const name = groups?.name;
    if (groups === undefined || name === undefined) {
        throw new Error(`capability probe ${probe}: outside the call grammar`);
    }
    const method = groups.dot !== undefined || groups.object !== undefined;
    return {
        argument: argumentOf(groups.argument ?? '', probe),
        callee: method
            ? {
                  kind: 'method',
                  name,
                  ...(groups.object === undefined ? {} : { object: groups.object }),
              }
            : { kind: 'bare', name },
        onACall: groups.chain !== undefined,
    };
}

/** Every call of a source, in the order its program holds them — none when it does not parse. */
export function callsOf(filename: string, source: string): AstNode[] {
    const program = parseProgram(filename, source);
    const calls: AstNode[] = [];
    if (isNode(program)) {
        walk(program, (node) => {
            if (node.type === 'CallExpression') {
                calls.push(node);
            }
        });
    }
    return calls;
}

/** The name a node spells, when it is an identifier. */
function identifier(node: unknown): string | undefined {
    return isNode(node) && node.type === 'Identifier' ? String(node.name) : undefined;
}

/** A non-computed member's property name. */
function propertyOf(member: AstNode): string | undefined {
    return member.computed === true ? undefined : identifier(member.property);
}

/** The text a string argument opens on: a literal's value, a template's first stretch. */
function stringOf(node: AstNode): string | undefined {
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
    }
    if (node.type === 'TemplateLiteral' && Array.isArray(node.quasis)) {
        const [first] = node.quasis as unknown[];
        const value: unknown = isNode(first) ? first.value : undefined;
        return typeof value === 'object' &&
            value !== null &&
            'cooked' in value &&
            typeof value.cooked === 'string'
            ? value.cooked
            : undefined;
    }
    return undefined;
}

/** The wrappers a type or a paren puts around an expression, which change no call. */
const TRANSPARENT = new Set([
    'ParenthesizedExpression',
    'TSAsExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
    'TSTypeAssertion',
]);

/** The expression under its type assertions and parentheses — `file('x') as never` is `file('x')`. */
function unwrapped(node: unknown): unknown {
    let current = node;
    while (isNode(current) && TRANSPARENT.has(current.type)) {
        current = current.expression;
    }
    return current;
}

/** Does the call's first argument answer what the shape asks? */
function argumentMatches(call: AstNode, argument: Argument): boolean {
    if (argument.kind === 'any') {
        return true;
    }
    const first = unwrapped(
        Array.isArray(call.arguments) ? (call.arguments as unknown[])[0] : undefined,
    );
    if (!isNode(first)) {
        return false;
    }
    if (argument.kind === 'call') {
        return first.type === 'CallExpression' && identifier(first.callee) === argument.callee;
    }
    if (argument.kind === 'string') {
        return stringOf(first)?.startsWith(argument.prefix) === true;
    }
    return first.type === (argument.kind === 'array' ? 'ArrayExpression' : 'ObjectExpression');
}

/** Is `node` a call whose last argument is a call? */
function wrapsACall(node: unknown): boolean {
    if (!isNode(node) || node.type !== 'CallExpression' || !Array.isArray(node.arguments)) {
        return false;
    }
    const last = unwrapped((node.arguments as unknown[]).at(-1));
    return isNode(last) && last.type === 'CallExpression';
}

/** Is this call the one the shape describes? */
export function isCallOf(call: AstNode, shape: CallShape): boolean {
    const { callee } = call;
    if (!isNode(callee)) {
        return false;
    }
    if (shape.callee.kind === 'bare') {
        return identifier(callee) === shape.callee.name && argumentMatches(call, shape.argument);
    }
    if (callee.type !== 'MemberExpression' || propertyOf(callee) !== shape.callee.name) {
        return false;
    }
    if (shape.callee.object !== undefined && identifier(callee.object) !== shape.callee.object) {
        return false;
    }
    if (shape.onACall && !wrapsACall(callee.object)) {
        return false;
    }
    return argumentMatches(call, shape.argument);
}
