import { dirname, join, resolve } from 'node:path';

import { isRelativePath } from '../../../model/chain/spec-path.js';
import { memberPropertyName, stringValue, walk } from '../../ast.js';
import { isDirectory, isFile, listDirectory, readFileCached } from '../../fs-cache.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

/** The relative path a golden matcher names, when the call is one and names it literally. */
function goldenPathOf(node: AstNode): string | undefined {
    const matcher = memberPropertyName(node.callee as AstNode);
    if (matcher !== 'toMatchFile' && matcher !== 'toMatchDirectory') {
        return undefined;
    }
    const name = stringValue((node.arguments as AstNode[] | undefined)?.[0]);
    return name !== undefined && isRelativePath(name) ? name : undefined;
}

/** A captured-ref token: `{{kind#ref}}`. Captures the ref name. */
const REF_TOKEN = /\{\{[A-Za-z][A-Za-z0-9]*#(?<ref>[\w.-]+)\}\}/gu;

/** Is this call `match.ref(...)`? */
function isMatchRef(node: AstNode): boolean {
    const callee = node.callee as AstNode | undefined;
    if (callee?.type !== 'MemberExpression' || memberPropertyName(callee) !== 'ref') {
        return false;
    }
    const object = callee.object as AstNode | undefined;
    return object?.type === 'Identifier' && object.name === 'match';
}

/** Ref names captured in a fixture text (or a directory-tree snapshot's files). */
function refsInFixture(target: string): string[] {
    const refs: string[] = [];
    const collect = (text: string): void => {
        for (const match of text.matchAll(REF_TOKEN)) {
            refs.push(match.groups?.ref ?? '');
        }
    };
    if (isFile(target)) {
        const text = readFileCached(target);
        if (text !== null) {
            collect(text);
        }
        return refs;
    }
    if (isDirectory(target)) {
        for (const entry of listDirectory(target) ?? []) {
            refs.push(...refsInFixture(join(target, entry)));
        }
    }
    return refs;
}

/**
 * CONVENTIONS D9 (warning) — a capture ref (`match.ref('order')`,
 * `{{uuid#order}}`) earns its keep only when it is asserted more than once (the
 * point of a capture is the equality check on later occurrences). Aggregating
 * per file — code `match.ref` literals plus the `{{kind#ref}}` tokens of the
 * golden files the file references — a ref that appears exactly once
 * everywhere is a plain matcher wearing a name.
 */
export const d9wSingleUseRef: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        const { inSpecs, role } = roleOf(file);
        if (!isTestRole(role) || !inSpecs) {
            return {};
        }
        const featureDir = dirname(file);
        return {
            Program(program: AstNode) {
                const counts = new Map<string, number>();
                const codeNodes = new Map<string, AstNode>();
                // Fallback report site for a ref that lives ONLY in a fixture:
                // The golden matcher's node that pulled it in. Per D9's normative
                // Text the count aggregates code + the goldens it references,
                // Fixtures, so a fixture-only ref used once must still warn —
                // Attached to its referencing node since it has no code site.
                const fixtureNodes = new Map<string, AstNode>();
                const bump = (ref: string): void => {
                    counts.set(ref, (counts.get(ref) ?? 0) + 1);
                };

                walk(program, (node) => {
                    if (node.type !== 'CallExpression') {
                        return;
                    }
                    if (isMatchRef(node)) {
                        const ref = stringValue((node.arguments as AstNode[] | undefined)?.[0]);
                        if (ref !== undefined) {
                            bump(ref);
                            if (!codeNodes.has(ref)) {
                                codeNodes.set(ref, node);
                            }
                        }
                        return;
                    }
                    const name = goldenPathOf(node);
                    if (name !== undefined) {
                        const target = resolve(featureDir, name.replace(/\/+$/u, ''));
                        for (const ref of refsInFixture(target)) {
                            bump(ref);
                            if (!fixtureNodes.has(ref)) {
                                fixtureNodes.set(ref, node);
                            }
                        }
                    }
                });

                for (const [ref, count] of counts) {
                    const node = codeNodes.get(ref) ?? fixtureNodes.get(ref);
                    if (count === 1 && node !== undefined) {
                        context.report({ data: { ref }, messageId: 'singleUse', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['d9w-single-use-ref'],
        messages: {
            singleUse:
                'Capture ref "{{ref}}" is used only once in this spec — a ref earns its name by asserting equality across occurrences; use a plain matcher instead.',
        },
        type: 'suggestion',
    },
};
