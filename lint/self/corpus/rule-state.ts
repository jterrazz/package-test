import type { Context } from '@oxlint/plugins';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { child, childList, identifierName, isNode, walk } from '../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../engine/project/ast.js';
import { parsedModule } from '../../engine/project/module-parser.js';
import type { PluginRule } from '../../engine/project/rule.js';

export const ROOT = resolve(import.meta.dirname, '../../..');

export function optionsOf(rules: Readonly<Record<string, unknown>>): Map<string, unknown[]> {
    return new Map(
        Object.entries(rules).map(([id, setting]) => [
            id,
            Array.isArray(setting) ? setting.slice(1) : [],
        ]),
    );
}

export function corpusOf(rule: string, lintSpecs: string): string[] {
    const fixtures = join(lintSpecs, rule, '_fixtures');
    let entries: string[];
    try {
        entries = readdirSync(fixtures, { recursive: true }).map(String);
    } catch {
        return [];
    }
    return entries
        .filter((entry) => /\.(?:[cm]?[jt]sx?)$/u.test(entry))
        .map((entry) => join(fixtures, entry))
        .toSorted();
}

type Verdict = { data: unknown; end: number; messageId: unknown; start: number };

function childrenOf(node: AstNode): AstNode[] {
    const found: AstNode[] = [];
    for (const [key, value] of Object.entries(node)) {
        if (key === 'parent') {
            continue;
        }
        for (const item of Array.isArray(value) ? value : [value]) {
            if (isNode(item)) {
                found.push(item);
            }
        }
    }
    return found;
}

function visit(node: AstNode, parent: AstNode | null, handlers: Visitor): void {
    node.parent = parent;
    handlers[node.type]?.(node);
    for (const inner of childrenOf(node)) {
        visit(inner, node, handlers);
    }
    handlers[`${node.type}:exit`]?.(node);
}

/** One visitor per rule, handed file after file, as oxlint does with a `createOnce` rule. */
export function session(
    rule: PluginRule,
    id: string,
    options: ReadonlyMap<string, unknown[]>,
): (file: string) => Verdict[] {
    const state: { file: string; source: object; verdicts: Verdict[] } = {
        file: '',
        source: {},
        verdicts: [],
    };
    const context = {
        get filename() {
            return state.file;
        },
        id: `jterrazz/${id}`,
        get options() {
            return options.get(`jterrazz/${id}`) ?? [];
        },
        get physicalFilename() {
            return state.file;
        },
        report(diagnostic: { data?: unknown; messageId?: unknown; node?: AstNode }) {
            state.verdicts.push({
                data: diagnostic.data,
                end: Number(diagnostic.node?.end),
                messageId: diagnostic.messageId,
                start: Number(diagnostic.node?.start),
            });
        },
        get sourceCode() {
            return state.source;
        },
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the slice of oxlint's context the rules read, and nothing else of it
    const handlers = rule.createOnce(context as unknown as Context);
    return (file) => {
        const text = readFileSync(file, 'utf8');
        const parsed = parsedModule(file, text);
        const { comments } = parsed;
        const program: unknown = parsed.program;
        state.file = file;
        state.verdicts = [];
        state.source = {
            ast: program,
            getAllComments: () => comments,
            getCommentsInside: (node: AstNode) =>
                comments.filter(
                    (comment) => comment.start >= node.start && comment.end <= node.end,
                ),
            text,
        };
        if (isNode(program) && handlers.before?.() !== false) {
            visit(program, null, handlers);
            handlers.after?.();
        }
        return state.verdicts;
    };
}

export function ruleSources(): string[] {
    return readdirSync(join(ROOT, 'lint/consumer/rules'), { recursive: true })
        .map(String)
        .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
        .map((entry) => join(ROOT, 'lint/consumer/rules', entry))
        .toSorted();
}

function memberName(node: AstNode): string | undefined {
    return identifierName(child(node, 'key'));
}

function assignedUnder(node: AstNode): string[] {
    const names: string[] = [];
    walk(node, (write) => {
        const name = identifierName(child(write, 'left'));
        if (write.type === 'AssignmentExpression' && name !== undefined) {
            names.push(name);
        }
    });
    return names;
}

/** Each `let` its body declares that neither `before` nor the `Program` handler assigns. */
export function unresetState(source: string): string[] {
    const program: unknown = parsedModule(source, readFileSync(source, 'utf8')).program;
    if (!isNode(program)) {
        return [`${source}: does not parse`];
    }
    const unreset: string[] = [];
    walk(program, (node) => {
        const body = child(child(node, 'value'), 'body');
        if (node.type !== 'Property' || memberName(node) !== 'createOnce' || body === undefined) {
            return;
        }
        const kept = childList(body, 'body')
            .filter((statement) => statement.type === 'VariableDeclaration')
            .filter((statement) => statement.kind === 'let')
            .flatMap((statement) => childList(statement, 'declarations'))
            .map((declarator) => identifierName(child(declarator, 'id')) ?? '');
        const assigned = new Set<string>();
        walk(body, (inner) => {
            const hook = inner.type === 'Property' ? memberName(inner) : undefined;
            if (hook === 'before' || hook === 'Program') {
                for (const name of assignedUnder(inner)) {
                    assigned.add(name);
                }
            }
        });
        unreset.push(...kept.filter((name) => !assigned.has(name)));
    });
    return unreset.map((name) => `${source.slice(ROOT.length + 1)}: ${name}`);
}
