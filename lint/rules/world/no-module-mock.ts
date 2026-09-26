import type { Context } from '@oxlint/plugins';

import { lessons, rowOf } from '../../catalogue/lesson.js';
import {
    child,
    childList,
    identifierName,
    importSourceVisitor,
    stringValue,
} from '../../reading/ast.js';
import type { AstNode, Visitor } from '../../reading/ast.js';
import { identityOf, segmentsOf } from '../../reading/linted-file.js';
import { isTestRole } from '../../reading/role.js';
import type { LintRule } from '../rule.js';

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/u;

/** An allowlist, never "has a dot": `../entities/dashboard.post` is ordinary code. */
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

/** `vi.mock(import('./x.js'), …)` too: `vitest/prefer-import-in-mock` requires that form, so reading only the string left no green spelling. */
function mockedSpecifier(argument: AstNode | undefined): string | undefined {
    const literal = stringValue(argument);
    if (literal !== undefined) {
        return literal;
    }
    if (argument?.type !== 'ImportExpression') {
        return undefined;
    }
    return stringValue(child(argument, 'source'));
}

/** `./payload.json?raw`, `./doc.md#frag`. */
function withoutSuffix(source: string): string {
    return source.replace(/[?#].*$/u, '');
}

type Scope = {
    allowed: Set<string>;
    banned: string | undefined;
    isTest: boolean;
};

function scopeOf(context: Context): Scope | undefined {
    const option = context.options[0];
    const stated =
        typeof option === 'object' && option !== null && 'modules' in option
            ? option.modules
            : undefined;
    const allowed = new Set(
        Array.isArray(stated) ? stated.filter((entry) => typeof entry === 'string') : [],
    );
    const { role } = identityOf(context);
    const banned = segmentsOf(context)
        .slice(0, -1)
        .find((part) => part === '__mocks__' || part === '__fixtures__');
    // Plus any file inside one of the two banned directories: that clause names the directory itself.
    if (!isTestRole(role) && banned === undefined) {
        return undefined;
    }
    // The module role's alone: a stub unit imports the `.response.json` it stands for.
    return { allowed, banned, isTest: role === 'module' && TEST_FILE.test(context.filename) };
}

/** A native module a consumer cannot inject is the one case the ladder cannot reach: `modules` allows it. `vi.stubGlobal` is an upstream option (`no-vitest-time-or-global-stub`, ADR-005). */
export const noModuleMock: LintRule = {
    createOnce(context: Context): Visitor {
        let scope: Scope | undefined;
        return {
            ...importSourceVisitor(({ node, source }) => {
                if (scope?.isTest === true && DATA_ASSET.test(withoutSuffix(source))) {
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
                if (named === undefined || scope?.allowed.has(named) !== true) {
                    context.report({ messageId: 'viMock', node });
                }
            },
            Program(node: AstNode) {
                if (scope?.banned !== undefined) {
                    context.report({ data: { dir: scope.banned }, messageId: 'bannedDir', node });
                }
            },
        };
    },
    meta: {
        docs: rowOf('no-module-mock'),
        messages: lessons('no-module-mock', {
            assetImport: {
                found: 'a module test imports the data asset "{{source}}"',
                fix: 'write the data as code in a `*.fixtures.ts` neighbour, or move the test under `specs/` as a `.spec.ts`',
            },
            bannedDir: {
                found: 'a `{{dir}}/` directory',
                fix: 'write the doubles as code — `mockOf<Port>()` inline, payloads in a `*.fixtures.ts` neighbour — and delete the directory',
            },
            viMock: {
                found: '`vi.mock` doubles a module for every importer',
                fix: 'double the port instead — `mockOf<Port>()`, `vi.fn()`, `vi.spyOn` — or put a native module no consumer can inject on the `modules` allow-list, with its reason',
            },
        }),
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
