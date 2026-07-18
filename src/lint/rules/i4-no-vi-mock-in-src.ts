import { importSourceVisitor, segments } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
/** Module-ish sources a src test may import; anything else with an extension is a data asset. */
const CODE_IMPORT = /\.[cm]?[jt]sx?$/;
/** Does this import path even carry an extension? Bare/extension-less ones are code. */
const HAS_EXTENSION = /\.[a-z0-9]+$/i;

/**
 * CONVENTIONS I4 — in module tests under `src/`, mocks and data are CODE:
 * `mockOf`/`mockOfDate` inline, large payloads in a `*.fixtures.ts` neighbour.
 * Flags, under `src/`:
 *
 * - `vi.mock(…)` calls (module mocking) in any file;
 * - files living in a `__mocks__/` or `__fixtures__/` directory;
 * - a `*.test.ts` importing a non-code asset (`.json`, `.txt`, `.sql`, …) —
 *   a test needing a real file is a specification and belongs in `specs/`.
 */
export const i4NoViMockInSrc: LintRule = {
    create(context: RuleContext) {
        const parts = segments(context.filename);
        if (!parts.includes('src')) {
            return {};
        }
        const banned = parts.find((part) => part === '__mocks__' || part === '__fixtures__');
        const isTest = TEST_FILE.test(context.filename);
        const visitor: Visitor = {
            CallExpression(node: AstNode) {
                const callee = node.callee as AstNode | undefined;
                if (callee?.type !== 'MemberExpression' || callee.computed === true) {
                    return;
                }
                const object = callee.object as AstNode | undefined;
                const property = callee.property as AstNode | undefined;
                if (
                    object?.type === 'Identifier' &&
                    object.name === 'vi' &&
                    property?.type === 'Identifier' &&
                    (property.name === 'mock' || property.name === 'doMock')
                ) {
                    context.report({ messageId: 'viMock', node });
                }
            },
            Program(node: AstNode) {
                if (banned !== undefined) {
                    context.report({ data: { dir: banned }, messageId: 'bannedDir', node });
                }
            },
        };
        if (isTest) {
            Object.assign(
                visitor,
                importSourceVisitor(({ node, source }) => {
                    if (HAS_EXTENSION.test(source) && !CODE_IMPORT.test(source)) {
                        context.report({ data: { source }, messageId: 'assetImport', node });
                    }
                }),
            );
        }
        return visitor;
    },
    meta: {
        docs: RULE_DOCS['i4-no-vi-mock-in-src'],
        messages: {
            assetImport:
                'A src/ module test must not import the data asset "{{source}}" — inline it as code or move the test to specs/ (CONVENTIONS I4).',
            bannedDir:
                '`{{dir}}/` directories are banned under src/ — mocks and data are code: mockOf/mockOfDate inline, payloads in a *.fixtures.ts neighbour (CONVENTIONS I4).',
            viMock: '`vi.mock` is banned under src/ — use mockOf/mockOfDate (CONVENTIONS I4).',
        },
        type: 'problem',
    },
};
