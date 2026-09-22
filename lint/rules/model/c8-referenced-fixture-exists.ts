import { dirname, resolve } from 'node:path';

import { isRelativePath } from '../../../src/model/chain/spec-path.js';
import { diskCallOf, specsAnchor } from '../../ast.js';
import { isDirectory, isFile } from '../../fs-cache.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';

/** The three suffixes that declare tests — `.test.ts(x)` and `.spec.ts`. */
const TEST_FILE = /\.(?:test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$/u;

/**
 * CONVENTIONS C8 — a path literal passed to a verb that reads the disk must
 * name an entry that exists, of the kind the verb reads, resolved from the
 * spec file's own directory. A typo that would fail only at run time is caught
 * statically. A non-literal argument, or one that is not a relative path (the
 * type's refusal, B2), is out of this rule's reach.
 */
export const c8ReferencedFixtureExists: LintRule = {
    create(context: RuleContext): Visitor {
        const file = context.physicalFilename;
        if (!TEST_FILE.test(file) || specsAnchor(file) === undefined) {
            return {};
        }
        const specDir = dirname(file);
        return {
            CallExpression(node: AstNode) {
                const disk = diskCallOf(node);
                const value = disk?.path;
                if (disk === undefined || value === undefined || !isRelativePath(value)) {
                    return;
                }
                const { kind } = disk;
                const target = resolve(specDir, value);
                const exists = kind === 'directory' ? isDirectory(target) : isFile(target);
                if (!exists) {
                    context.report({
                        data: { kind, path: value },
                        messageId: 'missing',
                        node: disk.node,
                    });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['c8-referenced-fixture-exists'],
        messages: {
            missing:
                '{{kind}}("{{path}}") names no {{kind}} on disk, read from the spec file\'s directory. Create it or fix the path.',
        },
        type: 'problem',
    },
};
