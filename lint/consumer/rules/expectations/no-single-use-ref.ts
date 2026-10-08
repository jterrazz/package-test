import {
    defineRule,
    isDirectory,
    isFile,
    listDirectory,
    readAt,
    readFileCached,
    rowNamed,
} from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, join, resolve } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    cookedText,
    memberPropertyName,
    stringValue,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { goldenOf } from '../../../kit/project/framework-calls.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isRelativePath } from '../../../kit/project/relative-path.js';
import { isTestRole } from '../../../kit/project/role.js';
import { TOKEN_KINDS } from '../../../kit/project/tokens.js';
import { consumerRows } from '../../catalogue/manifest.js';

function goldenPathOf(node: AstNode): string | undefined {
    const name = goldenOf(node)?.path;
    // Stryker disable next-line ConditionalExpression: a path no file holds yields no ref
    return name !== undefined && isRelativePath(name) ? name : undefined;
}

// invariant: a ref rides a token of the grammar; `{{kind#ref}}` in a lesson's prose is no capture.
const REF_TOKEN = new RegExp(
    String.raw`\{\{(?:${TOKEN_KINDS.join('|')})#(?<ref>[\w.-]+)\}\}`,
    'gu',
);

function isMatchRef(node: AstNode): boolean {
    const callee = child(node, 'callee');
    // Stryker disable next-line ConditionalExpression,OptionalChaining: memberPropertyName reads no name from a non-member
    if (callee?.type !== 'MemberExpression' || memberPropertyName(callee) !== 'ref') {
        return false;
    }
    const object = child(callee, 'object');
    // Stryker disable next-line OptionalChaining,ConditionalExpression: a member always has an object, and only an identifier has a name
    return object?.type === 'Identifier' && object.name === 'match';
}

function refsIn(text: string): string[] {
    // Stryker disable next-line OptionalChaining: a match of a pattern holding a named group always carries its groups
    return [...text.matchAll(REF_TOKEN)].map((match) => match.groups?.ref ?? '');
}

// invariant: a value written in place holds its tokens in a string or a template's text, as a golden file holds them on disk.
function inPlaceText(node: AstNode): string | undefined {
    if (node.type === 'TemplateElement') {
        return cookedText(node);
    }
    // invariant: a template is read through its elements, so its text is counted once.
    return node.type === 'Literal' ? stringValue(node) : undefined;
}

function refsInFixture(target: string): string[] {
    const refs: string[] = [];
    const collect = (text: string): void => {
        for (const match of text.matchAll(REF_TOKEN)) {
            // Stryker disable next-line OptionalChaining: a match of a pattern holding a named group always carries its groups
            refs.push(match.groups?.ref ?? '');
        }
    };
    if (isFile(target)) {
        const text = readFileCached(target);
        // Stryker disable next-line ConditionalExpression: a file read as a file always reads
        if (text !== null) {
            collect(text);
        }
        return refs;
    }
    // Stryker disable next-line ConditionalExpression: a path that holds nothing lists nothing
    if (isDirectory(target)) {
        for (const entry of listDirectory(target) ?? []) {
            refs.push(...refsInFixture(join(target, entry)));
        }
    }
    return refs;
}

function countInPlace(
    node: AstNode,
    bump: (ref: string) => void,
    sites: Map<string, AstNode>,
): void {
    // Stryker disable next-line StringLiteral: a node holding no text holds no token, as no text does
    for (const ref of refsIn(inPlaceText(node) ?? '')) {
        bump(ref);
        // Stryker disable next-line ConditionalExpression: a site is reported only for a ref written once, which has one site
        if (!sites.has(ref)) {
            sites.set(ref, node);
        }
    }
}

const row = rowNamed(consumerRows, 'no-single-use-ref');

/** Counted per file: code `match.ref` literals plus the `{{kind#ref}}` tokens of the goldens it names. */
export const noSingleUseRef = defineRule(
    {
        docs: row,
        messages: {
            singleUse: {
                found: 'the capture ref "{{ref}}" is used once in this spec',
                fix: 'use the plain token or matcher; a ref earns its name by asserting equality across two places',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
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
                    // invariant: a ref living only in a golden has no code site: it is reported on the matcher that pulled the golden in.
                    const fixtureNodes = new Map<string, AstNode>();
                    const bump = (ref: string): void => {
                        counts.set(ref, (counts.get(ref) ?? 0) + 1);
                    };

                    walk(program, (node) => {
                        countInPlace(node, bump, codeNodes);
                        // Stryker disable next-line ConditionalExpression,BlockStatement: a node that is no call is no matcher either
                        if (node.type !== 'CallExpression') {
                            return;
                        }
                        if (isMatchRef(node)) {
                            const ref = stringValue(childList(node, 'arguments')[0]);
                            if (ref !== undefined) {
                                bump(ref);
                                // Stryker disable next-line ConditionalExpression: a node is reported only for a ref read once
                                if (!codeNodes.has(ref)) {
                                    codeNodes.set(ref, node);
                                }
                            }
                            return;
                        }
                        const name = goldenPathOf(node);
                        if (name !== undefined) {
                            const target = resolve(featureDir, name);
                            for (const ref of refsInFixture(target)) {
                                bump(ref);
                                // Stryker disable next-line ConditionalExpression: a node is reported only for a ref read once
                                if (!fixtureNodes.has(ref)) {
                                    fixtureNodes.set(ref, node);
                                }
                            }
                        }
                    });

                    for (const [ref, count] of counts) {
                        const node = codeNodes.get(ref) ?? fixtureNodes.get(ref);
                        // Stryker disable next-line ConditionalExpression: a counted ref always has a site
                        if (count === 1 && node !== undefined) {
                            context.report({ data: { ref }, messageId: 'singleUse', node });
                        }
                    }
                },
            };
        },
    },
);
