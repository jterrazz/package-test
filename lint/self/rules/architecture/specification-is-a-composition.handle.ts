import {
    child,
    childList,
    identifierName,
    memberPath,
    memberPropertyName,
    propertyKeyName,
    stringValue,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode } from '../../../kit/project/ast.js';
import { importsOf, layerOf } from './specification-is-a-composition.file.js';

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

const STEPS = new Set(['arm', 'perform', 'reduce']);

const INVOKERS = new Set(['apply', 'call']);

type Step = { owner: string; step: string };

type Bindings = {
    readonly layers: Map<string, 'composition' | 'definition' | 'result'>;
    readonly steps: Map<string, Step>;
};

function bare(node: AstNode | undefined): AstNode | undefined {
    return node?.type === 'TSAsExpression' ||
        node?.type === 'TSSatisfiesExpression' ||
        node?.type === 'TSNonNullExpression' ||
        node?.type === 'ParenthesizedExpression'
        ? bare(child(node, 'expression'))
        : node;
}

/** `seed.reduce`, `seed['reduce']`. */
function readName(member: AstNode): string | undefined {
    return memberPropertyName(member) ?? stringValue(child(member, 'property'));
}

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

/** `seed`, `jobDefinition.composition`. */
function ownerOf(node: AstNode | undefined, bindings: Bindings): string | undefined {
    const root = rootName(node);
    const layer = root === undefined ? undefined : bindings.layers.get(root);
    return layer === 'definition' || layer === 'composition'
        ? (memberPath(bare(node)) ?? root)
        : undefined;
}

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

function stepRun(callee: AstNode | undefined, bindings: Bindings): Step | undefined {
    const read = bare(callee);
    const invoked =
        read?.type === 'MemberExpression' && INVOKERS.has(readName(read) ?? '')
            ? stepOf(child(read, 'object'), bindings)
            : undefined;
    return stepOf(read, bindings) ?? invoked;
}

function isRead(node: AstNode | undefined): boolean {
    const read = bare(node);
    return (
        read?.type === 'Identifier' ||
        (read?.type === 'MemberExpression' && isRead(child(read, 'object')))
    );
}

/** `{ reduce: run = undefined }` → reduce, run. */
function destructured(pattern: AstNode): [string, string][] {
    return childList(pattern, 'properties').flatMap((property): [string, string][] => {
        const key = propertyKeyName(property) ?? stringValue(child(property, 'key'));
        const value = child(property, 'value');
        const target = value?.type === 'AssignmentPattern' ? child(value, 'left') : value;
        const local = identifierName(target);
        return key !== undefined && local !== undefined ? [[key, local]] : [];
    });
}

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
