import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import { child, childList, identifierName, stringValue } from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { importSourceVisitor } from '../../../kit/project/import-sources.js';
import { identityOf, segmentsOf } from '../../../kit/project/linted-file.js';
import { isTestRole } from '../../../kit/project/role.js';
import { consumerRows } from '../../catalogue/manifest.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;

// invariant: an allowlist, never "has a dot": `../entities/dashboard.post` is ordinary code.
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

function isModuleDouble(node: AstNode): boolean {
    const callee = child(node, 'callee');
    // Stryker disable next-line OptionalChaining,ConditionalExpression: a call always has a callee, and only a member has an object
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

// outside: `vi.mock(import('../../../rules/mocks/x.js'), …)` too: `vitest/prefer-import-in-mock` requires that form, so reading only the string left no green spelling.
function mockedSpecifier(argument: AstNode | undefined): string | undefined {
    const literal = stringValue(argument);
    if (literal !== undefined) {
        return literal;
    }
    // Stryker disable next-line ConditionalExpression,OptionalChaining,BlockStatement: only an import expression has a source to read
    if (argument?.type !== 'ImportExpression') {
        return undefined;
    }
    return stringValue(child(argument, 'source'));
}

function withoutSuffix(source: string): string {
    // Stryker disable next-line Regex: `.*` runs to the end of the specifier anyway
    return source.replace(/[?#].*$/u, '');
}

type Scope = {
    allowed: Set<string>;
    banned: string | undefined;
    isTest: boolean;
    unreasoned: Set<string>;
};

type AllowList = { allowed: Set<string>; unreasoned: Set<string> };

function textOf(entry: object, key: string): string {
    const value: unknown = key in entry ? Reflect.get(entry, key) : undefined;
    // Stryker disable next-line ConditionalExpression: the schema admits only text
    return typeof value === 'string' ? value.trim() : '';
}

function allowListOf(context: Context): AllowList {
    const option = context.options[0];
    // Stryker disable ConditionalExpression,ArrayDeclaration,LogicalOperator: the schema admits only an object of `modules`, each a string or an object
    const stated: unknown =
        typeof option === 'object' && option !== null && 'modules' in option
            ? option.modules
            : undefined;
    const allowed = new Set<string>();
    const unreasoned = new Set<string>();
    const entries: unknown[] = Array.isArray(stated) ? stated : [];
    for (const entry of entries) {
        if (typeof entry === 'string') {
            unreasoned.add(entry);
        } else if (typeof entry === 'object' && entry !== null) {
            const module = textOf(entry, 'module');
            (textOf(entry, 'reason') === '' ? unreasoned : allowed).add(module);
        }
    }
    // Stryker restore ConditionalExpression,ArrayDeclaration,LogicalOperator
    return { allowed, unreasoned };
}

function scopeOf(context: Context): Scope | undefined {
    const { allowed, unreasoned } = allowListOf(context);
    const { role } = identityOf(context);
    const banned = segmentsOf(context)
        .slice(0, -1)
        .find((part) => part === '__mocks__');
    // invariant: plus any file inside the banned directory: that clause names the directory itself.
    if (!isTestRole(role) && banned === undefined) {
        return undefined;
    }
    // invariant: the module role's alone: a stub unit imports the `.response.json` it stands for.
    return {
        allowed,
        banned,
        // Stryker disable next-line LogicalOperator,ConditionalExpression: a `.test` file is of the module role, wherever it sits
        isTest: role === 'module' && TEST_FILE.test(context.filename),
        unreasoned,
    };
}

const row = rowNamed(consumerRows, 'no-module-mock');

/** A native module a consumer cannot inject is the one case the ladder cannot reach: `modules` allows it, each entry stating its reason. `vi.stubGlobal` is an upstream option (`no-vitest-time-or-global-stub`, ADR-005). */
export const noModuleMock = defineRule(
    {
        docs: row,
        messages: {
            assetImport: {
                found: 'a module test imports the data asset "{{source}}"',
                fix: 'write the data as code in a `<file>.fixtures.ts` beside the test, or move the test under `specs/` as a `.spec.ts`',
            },
            bannedDir: {
                found: 'a `{{dir}}/` directory',
                fix: "write the doubles as code — `mockOf<Port>()` inline, a module test's payloads in a `<file>.fixtures.ts` beside it, a spec's in `__fixtures__/` — and delete the directory",
            },
            unreasoned: {
                found: '"{{source}}" is on the `modules` allow-list with no reason',
                fix: "state why no consumer can inject it: `{ module: '{{source}}', reason: '<why>' }`",
            },
            viMock: {
                found: '`vi.mock` doubles a module for every importer',
                fix: 'double the port instead — `mockOf<Port>()`, `vi.fn()`, `vi.spyOn` — or put a native module no consumer can inject on the `modules` allow-list: `{ module, reason }`',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        schema: [
            {
                additionalProperties: false,
                properties: {
                    modules: {
                        items: {
                            additionalProperties: false,
                            properties: { module: { type: 'string' }, reason: { type: 'string' } },
                            type: ['object', 'string'],
                        },
                        type: 'array',
                    },
                },
                type: 'object',
            },
        ],
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let scope: Scope | undefined;
            return {
                // Stryker disable OptionalChaining: `before` runs no visitor where it found no scope
                ...importSourceVisitor(({ json, node, source }) => {
                    const path = withoutSuffix(source);
                    // invariant: a JSON file imported `with { type: 'json' }` is data a runtime parses, never a mock: a guard test reads it as the product does.
                    if (
                        scope?.isTest === true &&
                        DATA_ASSET.test(path) &&
                        !(json && path.endsWith('.json'))
                    ) {
                        context.report({ data: { source }, messageId: 'assetImport', node });
                    }
                }),
                before() {
                    scope = scopeOf(context);
                    return scope !== undefined;
                },
                CallExpression(node: AstNode) {
                    if (!isModuleDouble(node)) {
                        return;
                    }
                    const named = mockedSpecifier(childList(node, 'arguments')[0]);
                    // Stryker disable next-line ConditionalExpression: no specifier is on neither list
                    if (named !== undefined && scope?.unreasoned.has(named) === true) {
                        context.report({ data: { source: named }, messageId: 'unreasoned', node });
                        return;
                    }
                    // Stryker disable next-line ConditionalExpression: no specifier is on neither list
                    if (named === undefined || scope?.allowed.has(named) !== true) {
                        context.report({ messageId: 'viMock', node });
                    }
                },
                Program(node: AstNode) {
                    if (scope?.banned !== undefined) {
                        context.report({
                            data: { dir: scope.banned },
                            messageId: 'bannedDir',
                            node,
                        });
                    }
                },
                // Stryker restore OptionalChaining
            };
        },
    },
);
