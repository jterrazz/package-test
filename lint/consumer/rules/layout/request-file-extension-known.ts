import type { Context } from '@oxlint/plugins';
import { dirname, extname, join } from 'node:path';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { isDirectory, listDirectory } from '../../../engine/project/fs-cache.js';
import { GROUND_REQUESTS } from '../../../engine/project/ground.js';
import { identityOf } from '../../../engine/project/linted-file.js';
import { isTestRole } from '../../../engine/project/role.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';

/** Anchored on the visited test file: its sibling `_requests/` is probed, and a file with no extension is reported there. */
export const requestFileExtensionKnown: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before() {
                const { inSpecs, role } = identityOf(context);
                return isTestRole(role) && inSpecs;
            },
            Program(node: AstNode) {
                const requestsDir = join(dirname(context.physicalFilename), GROUND_REQUESTS);
                for (const entry of listDirectory(requestsDir) ?? []) {
                    if (extname(entry) === '' && !isDirectory(join(requestsDir, entry))) {
                        context.report({ data: { entry }, messageId: 'noExtension', node });
                    }
                }
            },
        };
    },
    meta: {
        docs: rowNamed(consumerRows, 'request-file-extension-known'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'request-file-extension-known'),
            {
                noExtension: {
                    found: '`_requests/{{entry}}` carries no extension',
                    fix: 'name it by how it is sent — `_requests/{{entry}}.http` for a whole request, `_requests/{{entry}}.json` for a body the app parses, any other extension for a body sent verbatim',
                },
            },
            CATALOGUE_CHAPTER,
        ),
        type: 'problem',
    },
};
