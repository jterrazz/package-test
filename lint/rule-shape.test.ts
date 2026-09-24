import type { Context } from '@oxlint/plugins';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseSync } from 'oxc-parser';
import { describe, expect, test } from 'vitest';

import { child, childList, identifierName, isNode, walk } from './ast.js';
import plugin from './plugin.js';
import type { AstNode, LintRule, Visitor } from './rule-shape.js';

const ROOT = resolve(import.meta.dirname, '..');

/** The options the E2E config hands each rule, by rule id. */
function e2eOptions(): Map<string, unknown[]> {
    const config: unknown = JSON.parse(
        readFileSync(join(ROOT, 'specs/fixtures/lint-cli/oxlint.e2e.json'), 'utf8'),
    );
    const rules =
        typeof config === 'object' && config !== null && 'rules' in config ? config.rules : {};
    const settings = typeof rules === 'object' && rules !== null ? Object.entries(rules) : [];
    return new Map(
        settings.map(([id, setting]) => [id, Array.isArray(setting) ? setting.slice(1) : []]),
    );
}

const E2E_OPTIONS = e2eOptions();

/** The source files of a rule's E2E fixture trees, in a stable order. */
function corpusOf(rule: string): string[] {
    const fixtures = join(ROOT, 'specs/lint', rule, 'fixtures');
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

/** One report, reduced to what a verdict is: where, which message, with what. */
type Verdict = { data: unknown; end: number; messageId: unknown; start: number };

/** The children of a parsed node, the way a visitor walks them. */
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

/** Enter and leave every node, parent first, the way oxlint hands them to a visitor. */
function visit(node: AstNode, parent: AstNode | null, handlers: Visitor): void {
    node.parent = parent;
    handlers[node.type]?.(node);
    for (const inner of childrenOf(node)) {
        visit(inner, node, handlers);
    }
    handlers[`${node.type}:exit`]?.(node);
}

/**
 * A lint session in this process: ONE visitor per rule, built once, handed
 * file after file — what oxlint does with a `createOnce` rule — and what each
 * file drew from it.
 */
function session(rule: LintRule, id: string): (file: string) => Verdict[] {
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
            return E2E_OPTIONS.get(`jterrazz/${id}`) ?? [];
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
        const parsed = parseSync(file, text);
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

/** Every rule module, by path. */
function ruleSources(): string[] {
    return readdirSync(join(ROOT, 'lint/rules'), { recursive: true })
        .map(String)
        .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))
        .map((entry) => join(ROOT, 'lint/rules', entry))
        .toSorted();
}

/** The name of an object member, when it is written as one. */
function memberName(node: AstNode): string | undefined {
    return identifierName(child(node, 'key'));
}

/** Every name an assignment writes, anywhere under `node`. */
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

/**
 * What a `createOnce` keeps across files and never resets when one opens: each
 * `let` its body declares that neither `before` nor the `Program` handler
 * assigns.
 */
function unresetState(source: string): string[] {
    const program: unknown = parseSync(source, readFileSync(source, 'utf8')).program;
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

describe('rule-shape — a rule built once judges each file as if it were the only one', () => {
    test('what a rule keeps for one file is reset when the next one opens', () => {
        // Given - every rule module, and the state its `createOnce` keeps between hooks
        const unreset = ruleSources().flatMap((source) => unresetState(source));

        // Then - `before` (or the `Program` handler, the first node of a file) writes each of them afresh
        expect(unreset).toStrictEqual([]);
    });

    test('every rule draws the same verdicts from a file, alone or after its whole corpus', () => {
        // Given - each rule's E2E fixture corpus, linted file by file with a visitor of their own, then twice through ONE visitor
        const drifted: string[] = [];
        let verdicts = 0;
        for (const [id, rule] of Object.entries(plugin.rules)) {
            const files = corpusOf(id);
            const alone = files.map((file) => session(rule, id)(file));
            const lint = session(rule, id);
            for (const file of files) {
                lint(file);
            }
            const sequenced = files.map((file) => lint(file));
            verdicts += alone.flat().length;
            for (const [index, file] of files.entries()) {
                if (JSON.stringify(sequenced[index]) !== JSON.stringify(alone[index])) {
                    drifted.push(`${id}: ${file.slice(ROOT.length + 1)}`);
                }
            }
        }

        // Then - what one file left in the visitor never reaches the next one, and the corpus was judged at all
        expect(drifted).toStrictEqual([]);
        expect(verdicts).toBeGreaterThan(0);
    });
});
