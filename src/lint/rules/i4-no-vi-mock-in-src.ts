import { importSourceVisitor, segments } from '../ast.js';
import { RULE_DOCS } from '../manifest.js';
import { isTestRole, roleOf } from '../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../types.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;

/**
 * Known DATA extensions — the closed list of what counts as a file asset. The
 * classification is an allowlist, never "has a dot": a module specifier is
 * routinely dotted for reasons that have nothing to do with a file type
 * (`../entities/dashboard.post`, `@scope/kernel/plugin.registry`), and reading
 * those as assets flagged perfectly ordinary code imports.
 */
const DATA_EXTENSIONS = [
    'avif',
    'bin',
    'bmp',
    'csv',
    'gif',
    'graphql',
    'gql',
    'gz',
    'htm',
    'html',
    'ico',
    'ini',
    'jpeg',
    'jpg',
    'json',
    'json5',
    'jsonc',
    'jsonl',
    'md',
    'mdx',
    'ndjson',
    'pdf',
    'png',
    'proto',
    'sql',
    'svg',
    'tar',
    'toml',
    'tsv',
    'txt',
    'wasm',
    'webp',
    'xml',
    'yaml',
    'yml',
    'zip',
];
const DATA_ASSET = new RegExp(`\\.(?:${DATA_EXTENSIONS.join('|')})$`, 'iu');

/** A bundler suffix (`./payload.json?raw`, `./doc.md#frag`) is not part of the extension. */
function withoutSuffix(source: string): string {
    return source.replace(/[?#].*$/u, '');
}

/**
 * CONVENTIONS I4 — in a test, mocks and data are CODE: `mockOf` inline, large
 * payloads in a `*.fixtures.ts` neighbour. The rule reaches every test file —
 * a module test, a rendered one, a spec under `specs/` — and flags:
 *
 * - `vi.mock(…)` calls (module mocking) in any of them;
 * - files living in a `__mocks__/` or `__fixtures__/` directory;
 * - in a `module`-role test only, an import of a known data asset (`.json`,
 *   `.txt`, `.sql`, …) — a test needing a real file is a specification and
 *   belongs under `specs/`. A contract unit legitimately imports its payload.
 *
 * A specifier whose extension is not on the data list is CODE, dotted or not:
 * `<subject>.<role>` module names are a naming convention, not a file type.
 */
export const i4NoViMockInSrc: LintRule = {
    create(context: RuleContext) {
        const { role } = roleOf(context.filename);
        const parts = segments(context.filename);
        const banned = parts
            .slice(0, -1)
            .find((part) => part === '__mocks__' || part === '__fixtures__');
        // Every TEST file — plus any file sitting inside one of the two banned
        // Directories, which is the clause that names the directory itself.
        if (!isTestRole(role) && banned === undefined) {
            return {};
        }
        // The data-asset clause is the MODULE role's alone: a contract unit
        // Legitimately imports the `.response.json` it stands for.
        const isTest = role === 'module' && TEST_FILE.test(context.filename);
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
                    if (DATA_ASSET.test(withoutSuffix(source))) {
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
                'A module test must not import the data asset "{{source}}" — inline it as code or move the test under specs/ as a `.spec.ts` (I4 — see docs/13-linting.md).',
            bannedDir:
                '`{{dir}}/` directories are banned — mocks and data are code: mockOf inline, payloads in a *.fixtures.ts neighbour (I4 — see docs/13-linting.md).',
            viMock: '`vi.mock` is banned in a test — use `mockOf<Port>()` (I4 — see docs/13-linting.md).',
        },
        type: 'problem',
    },
};
