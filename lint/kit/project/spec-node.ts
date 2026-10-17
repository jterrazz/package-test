import { PRESENCE, SpecSyntaxError } from './spec-grammar.js';
import type { PresenceShape } from './spec-grammar.js';
import { isMap, isNode, isPair, isScalar, isSeq, nodeItems, nodePairs } from './yaml-document.js';
import type { Node, Pair, YAMLMap, YamlSource } from './yaml-document.js';

export type Context = {
    fileName: string;
    source: YamlSource;
};

export function fail(
    context: Context,
    node: Node | null | Pair | undefined,
    message: string,
): never {
    throw new SpecSyntaxError(context.fileName, lineOf(context, node), message);
}

/** A pair sits on its key's line; a node the parser never placed, on the first. */
export function lineOf(context: Context, node: Node | null | Pair | undefined): number {
    const placed: unknown = isPair(node) ? node.key : node;
    // Stryker disable next-line LogicalOperator,ConditionalExpression: every node a refusal names, an empty value included, was placed by the parser
    return isNode(placed) && placed.range ? context.source.lineAt(placed.range[0]) : 1;
}

export function contentLine(context: Context, node: Node | null): number {
    const start = lineOf(context, node);
    return isScalar(node) && (node.type ?? '').startsWith('BLOCK') ? start + 1 : start;
}

export function requireMap(context: Context, node: Node | null, what: string): YAMLMap {
    if (!isMap(node)) {
        fail(context, node ?? undefined, `${what} must be a mapping of keys to values`);
    }
    return node;
}

export function closedPairs(
    context: Context,
    map: YAMLMap,
    allowed: readonly string[],
    what: string,
): Pair<Node, Node>[] {
    const pairs: Pair<Node, Node>[] = [];
    for (const pair of nodePairs(map)) {
        const key = scalarString(pair.key);
        if (key === null) {
            fail(context, pair, `${what}: a key must be a plain word`);
        }
        if (!allowed.includes(key)) {
            fail(
                context,
                pair,
                `unknown key "${key}:" in ${what}; known keys: ${allowed.join(', ')}`,
            );
        }
        pairs.push(pair);
    }
    return pairs;
}

export function keyed(pairs: readonly Pair<Node, Node>[]): Map<string, Pair<Node, Node>> {
    return new Map(pairs.map((pair) => [scalarString(pair.key) ?? '', pair]));
}

export function holdPresence(
    context: Context,
    found: ReadonlyMap<string, Pair<Node, Node>>,
    // Stryker disable next-line StringLiteral: only the files shape names a subject, and it always states one
    { line, shape, subject = '' }: { line: number; shape: PresenceShape; subject?: string },
): void {
    const at = (message: string, where = line): never => {
        throw new SpecSyntaxError(context.fileName, where, message);
    };
    for (const law of PRESENCE[shape]) {
        if (law.law === 'each') {
            const missing = law.keys.find((key) => !found.has(key));
            if (missing !== undefined) {
                at(law.refusal(subject, missing));
            }
        } else if (law.law === 'some') {
            if (!law.keys.some((key) => found.has(key))) {
                at(law.refusal(subject));
            }
        } else if (found.has(law.with)) {
            const beside = law.keys.find((key) => found.has(key));
            if (beside !== undefined) {
                at(law.refusal(subject, beside), lineOf(context, found.get(beside)));
            }
        }
    }
}

export function held(found: ReadonlyMap<string, Pair<Node, Node>>, key: string): Pair<Node, Node> {
    const pair = found.get(key);
    // Stryker disable next-line ConditionalExpression: holdPresence refused a document missing a key a law requires
    if (pair === undefined) {
        throw new Error(`"${key}:" is required by a presence law and was not found`);
    }
    return pair;
}

export function scalarString(node: unknown): null | string {
    return isScalar(node) && typeof node.value === 'string' ? node.value : null;
}

export function requireString(context: Context, node: Node | null, what: string): string {
    const value = scalarString(node);
    if (value === null) {
        fail(context, node, `${what} must be text`);
    }
    return value;
}

export function requireInteger(context: Context, node: Node | null, what: string): number {
    const value: unknown = isScalar(node) ? node.value : undefined;
    if (!Number.isInteger(value)) {
        fail(context, node, `${what} must be a literal integer`);
    }
    return Number(value);
}

export function stringList(
    context: Context,
    node: Node | null,
    what: string,
): { line: number; value: string }[] {
    if (isSeq(node)) {
        return nodeItems(node).map((item) => ({
            line: lineOf(context, item),
            value: requireString(context, item, `each entry of ${what}`),
        }));
    }
    return [{ line: lineOf(context, node), value: requireString(context, node, what) }];
}
