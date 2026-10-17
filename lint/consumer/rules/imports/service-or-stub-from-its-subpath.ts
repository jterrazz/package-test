import { defineRule, readAt, rowNamed } from '@jterrazz/typescript/rules';
import type { Context, Fix, Fixer } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    nodeEnd,
    nodeStart,
    stringField,
    stringValue,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { FRAMEWORK_ROOT, subpathOf } from '../../../kit/project/subpath-names.js';
import { consumerRows } from '../../catalogue/manifest.js';

type Moved = { name: string; node: AstNode; subpath: string; text: string };

type Declaration = {
    bare: string[];
    kept: string[];
    keyword: 'export' | 'import';
    moved: Moved[];
    node: AstNode;
    quote: string;
    typeOnly: boolean;
};

const NAMED = new Set(['ExportSpecifier', 'ImportSpecifier']);

function publishedName(specifier: AstNode): string | undefined {
    const name = child(specifier, specifier.type === 'ImportSpecifier' ? 'imported' : 'local');
    return identifierName(name) ?? stringValue(name);
}

function declarationOf(node: AstNode, text: string): Declaration | undefined {
    const source = child(node, 'source');
    if (stringValue(source) !== FRAMEWORK_ROOT) {
        return undefined;
    }
    const keyword = node.type === 'ImportDeclaration' ? 'import' : 'export';
    const declaration: Declaration = {
        bare: [],
        kept: [],
        keyword,
        moved: [],
        node,
        quote: text[nodeStart(source)] ?? "'",
        typeOnly: stringField(node, `${keyword}Kind`) === 'type',
    };
    for (const specifier of childList(node, 'specifiers')) {
        const written = text.slice(nodeStart(specifier), nodeEnd(specifier));
        if (!NAMED.has(specifier.type)) {
            declaration.bare.push(written);
            continue;
        }
        const name = publishedName(specifier);
        const subpath = name === undefined ? undefined : subpathOf(name);
        if (name === undefined || subpath === undefined) {
            declaration.kept.push(written);
        } else {
            declaration.moved.push({ name, node: specifier, subpath, text: written });
        }
    }
    return declaration;
}

function clause(
    { keyword, quote, typeOnly }: Declaration,
    bare: readonly string[],
    named: readonly string[],
    from: string,
): string {
    const parts = [...bare, ...(named.length > 0 ? [`{ ${named.join(', ')} }`] : [])];
    return `${keyword}${typeOnly ? ' type' : ''} ${parts.join(', ')} from ${quote}${from}${quote};`;
}

function rewritten(declaration: Declaration): string {
    const { bare, kept, moved } = declaration;
    const subpaths = [...new Set(moved.map(({ subpath }) => subpath))].toSorted();
    return [
        ...(bare.length + kept.length > 0 ? [clause(declaration, bare, kept, FRAMEWORK_ROOT)] : []),
        ...subpaths.map((subpath) =>
            clause(
                declaration,
                [],
                moved.filter((one) => one.subpath === subpath).map(({ text }) => text),
                subpath,
            ),
        ),
    ].join('\n');
}

function fixOf(fixer: Fixer, declaration: Declaration): Fix {
    return fixer.replaceTextRange(
        [nodeStart(declaration.node), nodeEnd(declaration.node)],
        rewritten(declaration),
    );
}

function namespacesOf(program: AstNode): Set<string> {
    const names = new Set<string>();
    for (const statement of childList(program, 'body')) {
        if (
            statement.type !== 'ImportDeclaration' ||
            stringValue(child(statement, 'source')) !== FRAMEWORK_ROOT
        ) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            const local = identifierName(child(specifier, 'local'));
            if (specifier.type === 'ImportNamespaceSpecifier' && local !== undefined) {
                names.add(local);
            }
        }
    }
    return names;
}

const row = rowNamed(consumerRows, 'service-or-stub-from-its-subpath');

/** A namespace import is read through its members, and is reported with no fix: which subpath a `t.` reaches is the reader's to restate. */
export const serviceOrStubFromItsSubpath = defineRule(
    {
        docs: row,
        fixable: 'code',
        messages: {
            fromRoot: {
                found: '`{{name}}` is imported from the root, `@jterrazz/test`',
                fix: 'import it from `{{subpath}}`; `typescript fix` moves the import',
            },
            throughNamespace: {
                found: '`{{namespace}}.{{name}}` reaches a name the root no longer publishes',
                fix: "import `{{name}}` from `{{subpath}}` by name: `import { {{name}} } from '{{subpath}}'`",
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            let namespaces = new Set<string>();
            const judge = (node: AstNode): void => {
                const declaration = declarationOf(node, context.sourceCode.text);
                if (declaration === undefined) {
                    return;
                }
                for (const [index, moved] of declaration.moved.entries()) {
                    context.report({
                        data: { name: moved.name, subpath: moved.subpath },
                        // invariant: one fix rewrites the whole declaration, so it rides on its first name alone: two fixes over one range would leave all but one unapplied.
                        ...(index === 0 && { fix: (fixer: Fixer) => fixOf(fixer, declaration) }),
                        messageId: 'fromRoot',
                        node: moved.node,
                    });
                }
            };
            return {
                before() {
                    namespaces = new Set();
                    return true;
                },
                ExportNamedDeclaration: judge,
                ImportDeclaration: judge,
                MemberExpression(node: AstNode) {
                    const namespace = identifierName(child(node, 'object'));
                    const name = memberPropertyName(node);
                    if (
                        namespace === undefined ||
                        name === undefined ||
                        !namespaces.has(namespace)
                    ) {
                        return;
                    }
                    const subpath = subpathOf(name);
                    if (subpath !== undefined) {
                        context.report({
                            data: { name, namespace, subpath },
                            messageId: 'throughNamespace',
                            node,
                        });
                    }
                },
                Program(program: AstNode) {
                    namespaces = namespacesOf(program);
                },
            };
        },
    },
);
