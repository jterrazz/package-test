import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import {
    child,
    childList,
    diskCallOf,
    identifierName,
    memberPropertyName,
} from '../../../engine/project/ast.js';
import type { AstNode, DiskCall, Visitor } from '../../../engine/project/ast.js';
import {
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundName,
} from '../../../engine/project/ground.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** A document that is a spec stands beside its test (`no-document-in-ground`); one that is an input to a negative spec is file material, under `fixtures/`. */
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
    const declaration = declarator.parent as AstNode | undefined;
    return declaration?.parent as AstNode | undefined;
}

/** An identifier resolves to the nearest `const` of that name whose block encloses the call, as the language resolves it. */
function diskArgument(
    argument: AstNode | undefined,
    bindings: ReadonlyMap<string, readonly AstNode[]>,
): DiskCall | undefined {
    const inline = diskCallOf(argument);
    const name = argument?.type === 'Identifier' ? identifierName(argument) : undefined;
    if (inline !== undefined || name === undefined) {
        return inline;
    }
    const declarators = bindings.get(name) ?? [];
    let scope = argument?.parent as AstNode | null | undefined;
    while (scope !== null && scope !== undefined) {
        const block = scope;
        const declarator = declarators.findLast((candidate) => blockOf(candidate) === block);
        if (declarator !== undefined) {
            return diskCallOf(child(declarator, 'init'));
        }
        scope = scope.parent as AstNode | null | undefined;
    }
    return undefined;
}

function groundOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundName(segment));
}

/** Judged by the first ground folder the literal path passes through; a computed path is out of reach. */
export const verbReadsItsGroundFolder: LintRule = {
    createOnce(context: Context): Visitor {
        let bindings = new Map<string, AstNode[]>();
        return {
            before() {
                bindings = new Map();
                return isTestRole(identityOf(context).role);
            },
            CallExpression(node: AstNode) {
                const callee = child(node, 'callee');
                const verb = callee === undefined ? undefined : memberPropertyName(callee);
                const role = verb === undefined ? undefined : ROLES[verb];
                if (verb === undefined || role === undefined) {
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
                const [reads] = role.grounds;
                context.report({
                    data: {
                        found: found === undefined ? 'no ground folder' : `${found}/`,
                        kind: disk.kind,
                        path: disk.path,
                        reads: reads === undefined ? 'a document beside the test' : `${reads}/`,
                        verb,
                        where:
                            reads === undefined
                                ? 'the folder its verb reads'
                                : `./${reads}/ beside the test, or in specs/shared/${reads}/ if several leaves share it`,
                    },
                    messageId: 'crossed',
                    node: argument?.type === 'Identifier' ? argument : disk.node,
                });
            },
            VariableDeclarator(node: AstNode) {
                const declaration = node.parent as AstNode | undefined;
                const name = identifierName(child(node, 'id'));
                if (declaration?.kind !== 'const' || name === undefined) {
                    return;
                }
                bindings.set(name, [...(bindings.get(name) ?? []), node]);
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'verb-reads-its-ground-folder'),
        messages: lessonsAt(rowNamed(consumerRows, 'verb-reads-its-ground-folder'), {
            crossed: {
                found: "`{{verb}}()` reads {{reads}}, and `{{kind}}('{{path}}')` names {{found}}",
                fix: 'move the file to {{where}}, and name it from there',
            },
        }),
        type: 'problem',
    },
};
