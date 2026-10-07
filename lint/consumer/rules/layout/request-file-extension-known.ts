import {
    defineRule,
    GROUND_REQUESTS,
    isDirectory,
    listDirectory,
    readAt,
    rowNamed,
} from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';
import { dirname, extname, join } from 'node:path';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const row = rowNamed(consumerRows, 'request-file-extension-known');

/** Anchored on the visited test file: its sibling `__requests__/` is probed, and a file with no extension is reported there. */
export const requestFileExtensionKnown = defineRule(
    {
        docs: row,
        messages: {
            noExtension: {
                found: '`__requests__/{{entry}}` carries no extension',
                fix: 'name it by how it is sent — `__requests__/{{entry}}.http` for a whole request, `__requests__/{{entry}}.json` for a body the app parses, any other extension for a body sent verbatim',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
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
    },
);
