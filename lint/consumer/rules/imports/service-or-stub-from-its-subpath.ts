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

// invariant: a specifier always names what it binds, by an identifier or a string.
function publishedName(specifier: AstNode): string {
    const name = child(specifier, specifier.type === 'ImportSpecifier' ? 'imported' : 'local');
    // Stryker disable next-line StringLiteral: no specifier names nothing
    return identifierName(name) ?? stringValue(name) ?? '';
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
        const subpath = subpathOf(name);
        if (subpath === undefined) {
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
    // invariant: a re-export from the root binds no namespace, so every statement is read by its source alone.
    for (const statement of childList(program, 'body')) {
        if (stringValue(child(statement, 'source')) !== FRAMEWORK_ROOT) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            if (specifier.type === 'ImportNamespaceSpecifier') {
                // Stryker disable next-line StringLiteral: a namespace import always binds a name
                names.add(identifierName(child(specifier, 'local')) ?? '');
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
        // Stryker disable next-line StringLiteral: the type is metadata, and no run reads it
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
                        // Stryker disable next-line ConditionalExpression: a fix on every name rewrites the one range alike, and the fixer applies one of overlapping fixes, so the output cannot tell them apart
                        ...(index === 0 && { fix: (fixer: Fixer) => fixOf(fixer, declaration) }),
                        messageId: 'fromRoot',
                        node: moved.node,
                    });
                }
            };
            return {
                ExportNamedDeclaration: judge,
                ImportDeclaration: judge,
                MemberExpression(node: AstNode) {
                    const namespace = identifierName(child(node, 'object'));
                    const name = memberPropertyName(node);
                    // Stryker disable next-line StringLiteral: no import binds the empty name
                    if (!namespaces.has(namespace ?? '') || name === undefined) {
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
