import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { anchorsOf } from '../../engine/catalogue/anchors.js';
import type { Finding } from '../../engine/checker/finding.js';
import {
    child,
    childList,
    identifierName,
    isNode,
    memberPropertyName,
    nodeStart,
    propertyKeyName,
    stringValue,
    walk,
} from '../../engine/project/ast.js';
import type { AstNode } from '../../engine/project/ast.js';
import { parseProgram } from '../../engine/project/module-parser.js';
import { byPosition, finding, isProduction, listed } from '../../engine/project/source.js';
import { positionOf } from '../../engine/project/spec-subjects.js';
import type { SelfPassId } from './checker.js';

const BUILT_IN_ERRORS: ReadonlySet<string> = new Set([
    'AggregateError',
    'Error',
    'EvalError',
    'RangeError',
    'ReferenceError',
    'SyntaxError',
    'TypeError',
    'URIError',
]);

const INVARIANT_MODULE = 'src/kernel/refusals/invariant.ts';

const CHAPTER_ANCHOR = /^(?<chapter>docs\/[^#]+\.md)#(?<anchor>.+)$/u;

function isRefusalCall(node: AstNode | undefined): boolean {
    return node?.type === 'CallExpression' && identifierName(child(node, 'callee')) === 'refusal';
}

function stackReadOf(node: AstNode): AstNode | undefined {
    if (memberPropertyName(node) === 'stack') {
        return child(node, 'object');
    }
    const pattern = child(node, 'id');
    const readsStack =
        node.type === 'VariableDeclarator' &&
        pattern?.type === 'ObjectPattern' &&
        childList(pattern, 'properties').some((entry) => propertyKeyName(entry) === 'stack');
    return readsStack ? child(node, 'init') : undefined;
}

type Judged = { at: AstNode; teaching: Pick<Finding, 'fix' | 'found'> };

function errorClasses(programs: AstNode[]): ReadonlySet<string> {
    const classes = new Set(BUILT_IN_ERRORS);
    const declared: { name: string; parent: string }[] = [];
    for (const program of programs) {
        walk(program, (node) => {
            const name = identifierName(child(node, 'id'));
            const parent = identifierName(child(node, 'superClass'));
            if (name !== undefined && parent !== undefined) {
                declared.push({ name, parent });
            }
        });
    }
    let grew = true;
    while (grew) {
        const before = classes.size;
        for (const { name, parent } of declared) {
            if (classes.has(parent)) {
                classes.add(name);
            }
        }
        grew = classes.size > before;
    }
    return classes;
}

function messageArgument(node: AstNode, name: string): AstNode | undefined {
    return childList(node, 'arguments')[name === 'AggregateError' ? 1 : 0];
}

function constructions(program: AstNode, classes: ReadonlySet<string>): Judged[] {
    const stackReads = new Set<AstNode>();
    const found: Judged[] = [];
    walk(program, (node) => {
        const read = stackReadOf(node);
        if (read !== undefined) {
            stackReads.add(read);
        }
        const name = identifierName(child(node, 'callee'));
        const constructs =
            name !== undefined &&
            ((node.type === 'NewExpression' && classes.has(name)) ||
                (node.type === 'CallExpression' && BUILT_IN_ERRORS.has(name)));
        if (!constructs || stackReads.has(node) || isRefusalCall(messageArgument(node, name))) {
            return;
        }
        const written = `${node.type === 'NewExpression' ? 'new ' : ''}${name}`;
        found.push({
            at: node,
            teaching: {
                fix: `a user can cause it: \`new ${name}(refusal({ found, why, fix, read }))\`, its read the chapter heading that explains it; only the framework can: \`invariant('<what broke>')\``,
                found: `\`${written}(…)\` carries a message written by hand`,
            },
        });
    });
    return found;
}

function readsOf(program: AstNode): Judged[] {
    const found: Judged[] = [];
    walk(program, (node) => {
        const argument = childList(node, 'arguments')[0];
        if (!isRefusalCall(node) || argument === undefined) {
            return;
        }
        found.push(...lessonsIn(argument).flatMap((lesson) => readOf(lesson)));
    });
    return found;
}

function lessonsIn(argument: AstNode): AstNode[] {
    if (argument.type === 'ConditionalExpression') {
        return [child(argument, 'consequent'), child(argument, 'alternate')].flatMap((branch) =>
            branch === undefined ? [] : lessonsIn(branch),
        );
    }
    return argument.type === 'ObjectExpression' ? [argument] : [];
}

function readOf(lesson: AstNode): Judged[] {
    const property = childList(lesson, 'properties').find(
        (entry) => propertyKeyName(entry) === 'read',
    );
    const value = child(property, 'value');
    const branches =
        value?.type === 'ConditionalExpression'
            ? [child(value, 'consequent'), child(value, 'alternate')]
            : [value];
    return branches
        .filter((branch) => stringValue(branch) === undefined)
        .map((branch) => ({
            at: branch ?? lesson,
            teaching: {
                fix: "write the heading it reads in place: `read: 'docs/<chapter>.md#<heading>'`",
                found: 'the refusal reads no chapter written in place',
            },
        }));
}

function anchorsNamed(program: AstNode, root: string): Judged[] {
    const found: Judged[] = [];
    walk(program, (node) => {
        const read =
            node.type === 'Literal' || node.type === 'TemplateLiteral'
                ? stringValue(node)
                : undefined;
        if (read === undefined || !CHAPTER_ANCHOR.test(read) || isHeading(read, root)) {
            return;
        }
        found.push({
            at: node,
            teaching: {
                fix: 'read a heading that exists, and write the section that explains the refusal where none does',
                found: `\`${read}\` names a heading no chapter has`,
            },
        });
    });
    return found;
}

function isHeading(read: string, root: string): boolean {
    const groups = CHAPTER_ANCHOR.exec(read)?.groups;
    const chapter = resolve(root, groups?.chapter ?? '');
    return (
        groups !== undefined &&
        existsSync(chapter) &&
        anchorsOf(readFileSync(chapter, 'utf8')).has(groups.anchor ?? '')
    );
}

export function checkErrorIsARefusalOrAnInvariant(root: string): Finding<SelfPassId>[] {
    const modules = listed(resolve(root, 'src'), 'src')
        .filter(({ directory, path }) => !directory && isProduction(path))
        .flatMap(({ path }) => {
            const text = readFileSync(resolve(root, path), 'utf8');
            const program = parseProgram(path, text);
            return isNode(program) ? [{ path, program, text }] : [];
        });
    const classes = errorClasses(modules.map(({ program }) => program));
    return modules
        .flatMap(({ path, program, text }) =>
            [
                ...(path === INVARIANT_MODULE ? [] : constructions(program, classes)),
                ...readsOf(program),
                ...anchorsNamed(program, root),
            ].map(({ at, teaching }) =>
                finding(
                    'error-is-a-refusal-or-an-invariant',
                    path,
                    teaching,
                    positionOf(text, nodeStart(at)),
                ),
            ),
        )
        .toSorted(byPosition);
}
