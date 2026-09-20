import {
    child,
    childList,
    identifierName,
    importSourceVisitor,
    segments,
    stringValue,
} from '../../ast.js';
import { RULE_DOCS } from '../../manifest.js';
import { isTestRole, roleOf } from '../../role.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../types.js';

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

/** Is this call `vi.mock(…)` / `vi.doMock(…)` — the module-level double? */
function isModuleDouble(node: AstNode): boolean {
    const callee = child(node, 'callee');
    if (callee?.type !== 'MemberExpression' || callee.computed === true) {
        return false;
    }
    const object = child(callee, 'object');
    const property = child(callee, 'property');
    return (
        identifierName(object) === 'vi' &&
        (identifierName(property) === 'mock' || identifierName(property) === 'doMock')
    );
}

/** A bundler suffix (`./payload.json?raw`, `./doc.md#frag`) is not part of the extension. */
function withoutSuffix(source: string): string {
    return source.replace(/[?#].*$/u, '');
}

/**
 * CONVENTIONS I4 — a test doubles a PORT, never a module.
 *
 * `vi.mock` replaces a specifier for everyone: the subject keeps its import,
 * the test keeps its expectation, and the thing in between is a file the
 * runner rewrote. The ladder's answer is a port — `mockOf<Port>()`, `vi.fn()`,
 * `vi.spyOn` on an object the test passes in — and the one case it cannot
 * reach is a NATIVE module a consumer cannot inject (a simulator binding, a
 * platform shim). That case is an allow-list: `modules: string[]` in the
 * config, with a comment saying why each one is there.
 *
 * The rule reaches every test file — a module test, a rendered one, a spec
 * under `specs/` — and flags:
 *
 * - `vi.mock(…)` / `vi.doMock(…)` of a specifier outside the allow-list;
 * - files living in a `__mocks__/` or `__fixtures__/` directory;
 * - in a `module`-role test only, an import of a known data asset (`.json`,
 *   `.txt`, `.sql`, …) — a test needing a real file is a specification and
 *   belongs under `specs/`. A contract unit legitimately imports its payload.
 *
 * `vi.stubGlobal` is not here: an upstream rule carries it as an option (M3),
 * and one owner per convention is ADR-005's law.
 *
 * A specifier whose extension is not on the data list is CODE, dotted or not:
 * `<subject>.<role>` module names are a naming convention, not a file type.
 */
export const i4NoModuleDoubles: LintRule = {
    create(context: RuleContext) {
        const option = context.options[0];
        const stated =
            typeof option === 'object' && option !== null && 'modules' in option
                ? option.modules
                : undefined;
        const allowed = new Set(
            Array.isArray(stated) ? stated.filter((entry) => typeof entry === 'string') : [],
        );
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
                if (!isModuleDouble(node)) {
                    return;
                }
                const named = stringValue(childList(node, 'arguments')[0]);
                // A native module a consumer cannot inject is the one case the
                // Ladder cannot reach, and the config says which.
                if (named === undefined || !allowed.has(named)) {
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
        docs: RULE_DOCS['i4-no-module-doubles'],
        messages: {
            assetImport:
                'A module test must not import the data asset "{{source}}" — inline it as code or move the test under specs/ as a `.spec.ts`.',
            bannedDir:
                '`{{dir}}/` directories are banned — mocks and data are code: mockOf inline, payloads in a *.fixtures.ts neighbour.',
            viMock: '`vi.mock` doubles a module for everyone — double the PORT instead: `mockOf<Port>()`, `vi.fn()`, `vi.spyOn`. A native module a consumer cannot inject goes on the `modules` allow-list, with the reason beside it (chapter 05 § Doubles).',
        },
        schema: [
            {
                additionalProperties: false,
                properties: { modules: { items: { type: 'string' }, type: 'array' } },
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
