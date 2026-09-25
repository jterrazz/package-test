import {
    child,
    childList,
    identifierName,
    memberPath,
    memberPropertyName,
    propertyKeyName,
    stringValue,
    walk,
} from './ast.js';
import { importsOf, layerOf } from './facet-file.js';
import type { AstNode } from './rule-shape.js';

/**
 * What a facet's constructor — `src/facets/<facet>/<facet>.handle.ts` — does
 * that the chain owns, read off its program: a definition's step it runs, a
 * result it builds. The self rule I6 reports each finding as it is returned.
 */

/** One thing a constructor does that the chain owns, as the rule's message names it. */
export type HandleFinding =
    | {
          readonly data: { readonly built: string };
          readonly messageId: 'buildsResult';
          readonly node: AstNode;
      }
    | {
          readonly data: { readonly owner: string; readonly step: string };
          readonly messageId: 'runsStep';
          readonly node: AstNode;
      };

/** A definition's own steps — what the chain runs, never its constructor. */
const STEPS = new Set(['arm', 'perform', 'reduce']);

/** What calls a function a step names without naming the step itself. */
const INVOKERS = new Set(['apply', 'call']);

/** A step of a definition, and what it is read off. */
type Step = { owner: string; step: string };

/** The names a constructor binds: the layer each is read off, and the steps it holds. */
type Bindings = {
    readonly layers: Map<string, 'definition' | 'facet' | 'result'>;
    readonly steps: Map<string, Step>;
};

/** The expression under a cast, a non-null assertion or parentheses. */
function bare(node: AstNode | undefined): AstNode | undefined {
    return node?.type === 'TSAsExpression' ||
        node?.type === 'TSSatisfiesExpression' ||
        node?.type === 'TSNonNullExpression' ||
        node?.type === 'ParenthesizedExpression'
        ? bare(child(node, 'expression'))
        : node;
}

/** The name a member reads, by a written key or a string one: `seed.reduce`, `seed['reduce']`. */
function readName(member: AstNode): string | undefined {
    return memberPropertyName(member) ?? stringValue(child(member, 'property'));
}

/** The identifier a chain of reads and calls starts from, through its casts. */
function rootName(node: AstNode | undefined): string | undefined {
    const read = bare(node);
    if (read?.type === 'MemberExpression') {
        return rootName(child(read, 'object'));
    }
    if (read?.type === 'CallExpression') {
        return rootName(child(read, 'callee'));
    }
    return read?.type === 'ChainExpression' || read?.type === 'AwaitExpression'
        ? rootName(child(read, 'expression') ?? child(read, 'argument'))
        : identifierName(read);
}

/** What a value is read off, when that is a definition or a facet: `seed`, `jobsFacet.composition`. */
function ownerOf(node: AstNode | undefined, bindings: Bindings): string | undefined {
    const root = rootName(node);
    const layer = root === undefined ? undefined : bindings.layers.get(root);
    return layer === 'definition' || layer === 'facet'
        ? (memberPath(bare(node)) ?? root)
        : undefined;
}

/** The step a value is, when it names one: a step read off a definition, or a name bound to one. */
function stepOf(node: AstNode | undefined, bindings: Bindings): Step | undefined {
    const read = bare(node);
    if (read?.type === 'Identifier') {
        return bindings.steps.get(identifierName(read) ?? '');
    }
    const step = read?.type === 'MemberExpression' ? readName(read) : undefined;
    const owner = ownerOf(child(read, 'object'), bindings);
    return step !== undefined && STEPS.has(step) && owner !== undefined
        ? { owner, step }
        : undefined;
}

/** The step a call runs: the callee's, or the one it runs through `call`/`apply`. */
function stepRun(callee: AstNode | undefined, bindings: Bindings): Step | undefined {
    const read = bare(callee);
    const invoked =
        read?.type === 'MemberExpression' && INVOKERS.has(readName(read) ?? '')
            ? stepOf(child(read, 'object'), bindings)
            : undefined;
    return stepOf(read, bindings) ?? invoked;
}

/** Is the value a name or a read off one — no call a binding would stand for? */
function isRead(node: AstNode | undefined): boolean {
    const read = bare(node);
    return (
        read?.type === 'Identifier' ||
        (read?.type === 'MemberExpression' && isRead(child(read, 'object')))
    );
}

/** The locals a pattern binds from its object's keys: `{ reduce: run = undefined }` → reduce, run. */
function destructured(pattern: AstNode): [string, string][] {
    return childList(pattern, 'properties').flatMap((property): [string, string][] => {
        const key = propertyKeyName(property) ?? stringValue(child(property, 'key'));
        const value = child(property, 'value');
        const target = value?.type === 'AssignmentPattern' ? child(value, 'left') : value;
        const local = identifierName(target);
        return key !== undefined && local !== undefined ? [[key, local]] : [];
    });
}

/** Binds what a declarator names: a step, an alias of what a layer holds, or steps destructured. */
function bind(declarator: AstNode, bindings: Bindings): void {
    const id = child(declarator, 'id');
    const init = child(declarator, 'init');
    const local = identifierName(id);
    const step = stepOf(init, bindings);
    const layer = bindings.layers.get(rootName(init) ?? '');
    if (local !== undefined && step !== undefined) {
        bindings.steps.set(local, step);
    } else if (local !== undefined && layer !== undefined && isRead(init)) {
        bindings.layers.set(local, layer);
    }
    const owner = ownerOf(init, bindings);
    if (id?.type !== 'ObjectPattern' || owner === undefined) {
        return;
    }
    for (const [key, name] of destructured(id)) {
        if (STEPS.has(key)) {
            bindings.steps.set(name, { owner, step: key });
        }
    }
}

/** Every name the program binds, wherever it is declared, bound to a fixed point. */
function bindingsOf(program: AstNode): Bindings {
    const bindings: Bindings = { layers: new Map(), steps: new Map() };
    for (const [local, source] of importsOf(program)) {
        const layer = layerOf(source);
        if (layer !== undefined) {
            bindings.layers.set(local, layer);
        }
    }
    const declarators: AstNode[] = [];
    walk(program, (node) => {
        if (node.type === 'VariableDeclarator') {
            declarators.push(node);
        }
    });
    for (let size = -1; size !== bindings.layers.size + bindings.steps.size;) {
        size = bindings.layers.size + bindings.steps.size;
        for (const declarator of declarators) {
            bind(declarator, bindings);
        }
    }
    return bindings;
}

/**
 * Every finding of a constructor: a call that runs a definition's step —
 * read off it, off an alias of it, through `call`/`apply`, or bound to a name
 * wherever the binding is written — and a result it builds with `new`.
 */
export function handleFileFindings(program: AstNode): HandleFinding[] {
    const bindings = bindingsOf(program);
    const findings: HandleFinding[] = [];
    walk(program, (node) => {
        const callee = child(node, 'callee');
        const run = node.type === 'CallExpression' ? stepRun(callee, bindings) : undefined;
        const built = node.type === 'NewExpression' ? rootName(callee) : undefined;
        if (run !== undefined) {
            findings.push({ data: run, messageId: 'runsStep', node });
        }
        if (built !== undefined && bindings.layers.get(built) === 'result') {
            const name = memberPath(bare(callee)) ?? built;
            findings.push({ data: { built: name }, messageId: 'buildsResult', node });
        }
    });
    return findings;
}
