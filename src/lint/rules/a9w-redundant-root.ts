import { dirname, join, resolve } from 'node:path';

import { findProperty, specificationMember, stringValue } from '../ast.js';
import { isFile } from '../fs-cache.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext } from '../types.js';

/**
 * The root the convention would derive (A9 — see docs/10-linting.md): walk up from the
 * specification file to the first directory containing
 * `docker/compose.test.yaml`, else the first containing `package.json`.
 */
function derivedRoot(startDir: string): string | undefined {
    for (const probe of ['docker/compose.test.yaml', 'package.json']) {
        let dir = startDir;
        for (;;) {
            if (isFile(join(dir, probe))) {
                return dir;
            }
            const parent = dirname(dir);
            if (parent === dir) {
                break;
            }
            dir = parent;
        }
    }
    return undefined;
}

/**
 * CONVENTIONS A9 (warning) — `root` is an override reserved for cases the
 * convention cannot resolve. When the literal points at the very directory the
 * walk-up would have found, it is redundant and flagged.
 */
export const a9wRedundantRoot: LintRule = {
    create(context: RuleContext) {
        return {
            CallExpression(node: AstNode) {
                if (specificationMember(node) === undefined) {
                    return;
                }
                for (const argument of (node.arguments as AstNode[] | undefined) ?? []) {
                    const root = findProperty(argument, 'root');
                    const literal = stringValue(root?.value as AstNode | undefined);
                    if (root === undefined || literal === undefined) {
                        continue;
                    }
                    const specDir = dirname(context.physicalFilename);
                    if (resolve(specDir, literal) === derivedRoot(specDir)) {
                        context.report({
                            data: { root: literal },
                            messageId: 'redundant',
                            node: root,
                        });
                    }
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['a9w-redundant-root'],
        messages: {
            redundant:
                'root: "{{root}}" is redundant — walking up from the specification file already resolves to that directory (A9 — see docs/10-linting.md).',
        },
        type: 'suggestion',
    },
};
