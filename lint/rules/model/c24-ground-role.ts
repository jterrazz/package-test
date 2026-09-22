import {
    GROUND_EXPECTED,
    GROUND_FIXTURES,
    GROUND_REQUESTS,
    GROUND_SEEDS,
    isGroundName,
} from '../../../src/model/chain/ground.js';
import { child, childList, diskCallOf, memberPropertyName } from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';
import { isTestRole, roleOf } from '../../role.js';

/**
 * The ground folder each verb reads, and which argument names the disk. `run`
 * reads a document: one that is a spec stands beside its test, under NO ground
 * folder (C16 holds the same law from the tree's side), and one that is an
 * INPUT — a deliberately wrong document a negative spec runs, which no glob
 * may collect — is file material, under `fixtures/`.
 */
const ROLES: Record<string, { argument: number; grounds: readonly (string | undefined)[] }> = {
    fixture: { argument: 0, grounds: [GROUND_FIXTURES] },
    post: { argument: 1, grounds: [GROUND_REQUESTS] },
    put: { argument: 1, grounds: [GROUND_REQUESTS] },
    request: { argument: 0, grounds: [GROUND_REQUESTS] },
    run: { argument: 0, grounds: [undefined, GROUND_FIXTURES] },
    seed: { argument: 0, grounds: [GROUND_SEEDS] },
    toMatch: { argument: 0, grounds: [GROUND_EXPECTED] },
};

/** The first ground folder a path passes through, if any. */
function groundOf(path: string): string | undefined {
    return path.split('/').find((segment) => isGroundName(segment));
}

/**
 * CONVENTIONS C24 — the verb and the ground folder agree. `seed()` reads
 * `seeds/`, `request()` and a request body read `requests/`, `fixture()` reads
 * `fixtures/`, a golden reads `expected/`, and `run()` reads a document beside
 * the test — or, for a document that is an input, under `fixtures/`. A `file()`/`directory()` handed to a verb
 * is judged by the FIRST ground folder its literal path passes through; a
 * computed path is out of reach.
 */
export const c24GroundRole: LintRule = {
    create(context: RuleContext): Visitor {
        if (!isTestRole(roleOf(context.physicalFilename).role)) {
            return {};
        }
        return {
            CallExpression(node: AstNode) {
                const callee = child(node, 'callee');
                const verb = callee === undefined ? undefined : memberPropertyName(callee);
                const role = verb === undefined ? undefined : ROLES[verb];
                if (verb === undefined || role === undefined) {
                    return;
                }
                const disk = diskCallOf(childList(node, 'arguments')[role.argument]);
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
                    },
                    messageId: 'crossed',
                    node: disk.node,
                });
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c24-ground-role'],
        messages: {
            crossed:
                "{{verb}}() reads {{reads}}, and {{kind}}('{{path}}') names {{found}} — put the file in the folder its verb reads.",
        },
        type: 'problem',
    },
};
