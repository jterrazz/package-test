import {
    isDirectory,
    isFile,
    lessonsAt,
    listDirectory,
    readFileCached,
    rowNamed,
} from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, join, resolve } from 'node:path';

import { goldenOf, memberPropertyName, stringValue, walk } from '../../../engine/project/ast.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isRelativePath } from '../../../engine/project/relative-path.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

function goldenPathOf(node: AstNode): string | undefined {
    const name = goldenOf(node)?.path;
    return name !== undefined && isRelativePath(name) ? name : undefined;
}

const REF_TOKEN = /\{\{[A-Za-z][A-Za-z0-9]*#(?<ref>[\w.-]+)\}\}/gu;

function isMatchRef(node: AstNode): boolean {
    const callee = node.callee as AstNode | undefined;
    if (callee?.type !== 'MemberExpression' || memberPropertyName(callee) !== 'ref') {
        return false;
    }
    const object = callee.object as AstNode | undefined;
    return object?.type === 'Identifier' && object.name === 'match';
}

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

/** Counted per file: code `match.ref` literals plus the `{{kind#ref}}` tokens of the goldens it names. */
export const noSingleUseRef: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const { inSpecs, role } = identityOf(context);
                return isTestRole(role) && inSpecs;
            },
            Program(program: AstNode) {
                const featureDir = dirname(context.physicalFilename);
                const counts = new Map<string, number>();
                const codeNodes = new Map<string, AstNode>();
                // A ref living only in a golden has no code site: it is reported on the matcher that pulled the golden in.
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
        docs: rowNamed(consumerRows, 'no-single-use-ref'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'no-single-use-ref'),
            {
                singleUse: {
                    found: 'the capture ref "{{ref}}" is used once in this spec',
                    fix: 'use the plain token or matcher; a ref earns its name by asserting equality across two places',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'suggestion',
    },
};
