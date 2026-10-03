import {
    defineRule,
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundFolder,
    readAt,
    rowNamed,
} from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList, identifierName, memberPropertyName } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { diskCallOf } from '../../../kit/project/framework-calls.js';
import type { DiskCall } from '../../../kit/project/framework-calls.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** A document that is a spec stands beside its test (`no-document-in-ground`); one that is an input to a negative spec is file material, under `_fixtures/`. */
const ROLES: Record<string, { argument: number; grounds: readonly (string | undefined)[] }> = {
    fixture: { argument: 0, grounds: [GROUND_FIXTURES] },
    post: { argument: 1, grounds: [GROUND_REQUESTS] },
    put: { argument: 1, grounds: [GROUND_REQUESTS] },
    request: { argument: 0, grounds: [GROUND_REQUESTS] },
    run: { argument: 0, grounds: [undefined, GROUND_FIXTURES] },
    seed: { argument: 0, grounds: [GROUND_SEEDS] },
    toMatch: { argument: 0, grounds: [GROUND_EXPECTED] },
};

function blockOf(declarator: AstNode): AstNode | undefined {
    const declaration = child(declarator, 'parent');
    return child(declaration, 'parent');
}

/** An identifier resolves to the nearest `const` of that name whose block encloses the call, as the language resolves it. */
function diskArgument(
    argument: AstNode | undefined,
    bindings: ReadonlyMap<string, readonly AstNode[]>,
): DiskCall | undefined {
    const inline = diskCallOf(argument);
    // Stryker disable ConditionalExpression,OptionalChaining,LogicalOperator,ArrayDeclaration: an inline call names no binding, and a name with no binding resolves to none
    const name = argument?.type === 'Identifier' ? identifierName(argument) : undefined;
    if (inline !== undefined || name === undefined) {
        return inline;
    }
    const declarators = bindings.get(name) ?? [];
    let scope = child(argument, 'parent');
    while (scope !== null && scope !== undefined) {
        // Stryker restore ConditionalExpression,OptionalChaining,LogicalOperator,ArrayDeclaration
        const block = scope;
        const declarator = declarators.findLast((candidate) => blockOf(candidate) === block);
        if (declarator !== undefined) {
            return diskCallOf(child(declarator, 'init'));
        }
        scope = child(scope, 'parent');
    }
    return undefined;
}

function groundOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundFolder(segment));
}

function crossing(reads: string | undefined, found: string | undefined): Record<string, string> {
    return {
        found: found === undefined ? 'no ground folder' : `${found}/`,
        reads: reads === undefined ? 'a document beside the test' : `${reads}/`,
        where:
            reads === undefined
                ? 'the folder its verb reads'
                : `./${reads}/ beside the test, or in the ${reads}/ of the lowest folder the leaves share (specs/_shared/${reads}/ across facets)`,
    };
}

const row = rowNamed(consumerRows, 'verb-reads-its-ground-folder');

/** Judged by the first ground folder the literal path passes through; a computed path is out of reach. */
export const verbReadsItsGroundFolder = defineRule(
    {
        docs: row,
        messages: {
            crossed: {
                found: "`{{verb}}()` reads {{reads}}, and `{{kind}}('{{path}}')` names {{found}}",
                fix: 'move the file to {{where}}, and name it from there',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let bindings = new Map<string, AstNode[]>();
            return {
                before() {
                    bindings = new Map();
                    return isTestRole(identityOf(context).role);
                },
                CallExpression(node: AstNode) {
                    // Stryker disable ConditionalExpression: a call always has a callee, and no verb has a role
                    const callee = child(node, 'callee');
                    const verb = callee === undefined ? undefined : memberPropertyName(callee);
                    const role = verb === undefined ? undefined : ROLES[verb];
                    if (verb === undefined || role === undefined) {
                        // Stryker restore ConditionalExpression
                        return;
                    }
                    const argument = childList(node, 'arguments')[role.argument];
                    const disk = diskArgument(argument, bindings);
                    if (disk?.path === undefined) {
                        return;
                    }
                    const found = groundOf(disk.path);
                    if (role.grounds.includes(found)) {
                        return;
                    }
                    context.report({
                        data: {
                            ...crossing(role.grounds[0], found),
                            kind: disk.kind,
                            path: disk.path,
                            verb,
                        },
                        messageId: 'crossed',
                        // Stryker disable next-line OptionalChaining: a disk call came from an argument
                        node: argument?.type === 'Identifier' ? argument : disk.node,
                    });
                },
                VariableDeclarator(node: AstNode) {
                    const declaration = child(node, 'parent');
                    const name = identifierName(child(node, 'id'));
                    // Stryker disable next-line OptionalChaining,ConditionalExpression: a declarator always has its declaration, and no name is ever looked up
                    if (declaration?.kind !== 'const' || name === undefined) {
                        return;
                    }
                    // Stryker disable next-line ArrayDeclaration: an entry that is no declarator resolves no name
                    bindings.set(name, [...(bindings.get(name) ?? []), node]);
                },
            };
        },
    },
);
