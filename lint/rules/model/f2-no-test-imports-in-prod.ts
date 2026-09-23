import { dirname, relative, resolve } from 'node:path';

import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    stringValue,
    walk,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, RuleContext, Visitor } from '../../oxlint-api.js';
import {
    isProductionModule,
    materialNamed,
    moduleReferenceVisitor,
    reachOf,
} from '../../production.js';
import type { MaterialKind } from '../../production.js';
import { projectRootOf } from '../../role.js';

/** The calls that read a file or a folder by its path. */
const FS_READ = /^(?:createReadStream|opendir(?:Sync)?|read\w*)$/u;

/** The calls that build a path from pieces. */
const PATH_BUILDERS = new Set(['join', 'resolve']);

/** The names a CommonJS module is handed for where it sits. */
const COMMONJS_ANCHORS = new Set(['__dirname', '__filename']);

/** The name a call's callee goes by — `readFileSync`, `fs.readFileSync`, `path.join`. */
function calleeName(node: AstNode): string | undefined {
    const callee = child(node, 'callee');
    return (
        identifierName(callee) ?? (callee === undefined ? undefined : memberPropertyName(callee))
    );
}

/** The arguments of a call or a `new`. */
function argumentsOf(node: AstNode): AstNode[] {
    return childList(node, 'arguments');
}

/** Is this `import.meta.url` — what a `new URL(…)` resolves against? */
function isImportMetaUrl(node: AstNode | undefined): boolean {
    return (
        node?.type === 'MemberExpression' &&
        child(node, 'object')?.type === 'MetaProperty' &&
        memberPropertyName(node) === 'url'
    );
}

/**
 * Does this expression name where the module sits — `import.meta.*`,
 * `__dirname`, `__filename`, or a module-scope binding made of one?
 */
function isAnchor(node: AstNode | undefined, anchors: Set<string>): boolean {
    if (node === undefined) {
        return false;
    }
    let found = false;
    walk(node, (inner) => {
        if (inner.type === 'MetaProperty') {
            found = true;
        } else {
            const name = identifierName(inner) ?? '';
            found ||= COMMONJS_ANCHORS.has(name) || anchors.has(name);
        }
    });
    return found;
}

/** The module-scope bindings initialised from where the module sits. */
function anchorsOf(program: AstNode): Set<string> {
    const anchors = new Set<string>();
    for (const statement of childList(program, 'body')) {
        const declaration =
            statement.type === 'ExportNamedDeclaration'
                ? child(statement, 'declaration')
                : statement;
        for (const declarator of childList(declaration, 'declarations')) {
            const name = identifierName(child(declarator, 'id'));
            if (name !== undefined && isAnchor(child(declarator, 'init'), anchors)) {
                anchors.add(name);
            }
        }
    }
    return anchors;
}

/** The literal pieces a path builder is handed after its anchor, up to the first that is not one. */
function literalTail(pieces: AstNode[]): string[] {
    const tail: string[] = [];
    for (const piece of pieces) {
        const value = stringValue(piece);
        if (value === undefined) {
            break;
        }
        tail.push(value);
    }
    return tail;
}

/**
 * The path an anchored expression names in the module's own tree, up to its
 * first piece that is not a literal: `join(import.meta.dirname, 'fixtures',
 * name)` names `<here>/fixtures`, `` `${__dirname}/seeds/rows.sql` `` the file.
 */
function anchoredPath(node: AstNode, here: string, anchors: Set<string>): string | undefined {
    if (node.type === 'CallExpression' && PATH_BUILDERS.has(calleeName(node) ?? '')) {
        const [first, ...rest] = argumentsOf(node);
        const tail = literalTail(rest);
        if (!isAnchor(first, anchors) || tail.length === 0) {
            return undefined;
        }
        return resolve(here, ...tail);
    }
    if (node.type === 'TemplateLiteral') {
        const [hole] = childList(node, 'expressions');
        const quasis = childList(node, 'quasis');
        const cooked = (index: number): string => {
            const value = quasis[index]?.value;
            const text =
                typeof value === 'object' && value !== null && 'cooked' in value
                    ? value.cooked
                    : undefined;
            return typeof text === 'string' ? text : '';
        };
        if (!isAnchor(hole, anchors) || cooked(0) !== '' || !cooked(1).startsWith('/')) {
            return undefined;
        }
        return resolve(here, `.${cooked(1)}`);
    }
    return undefined;
}

/**
 * CONVENTIONS F2 — production never reaches test material. In a production
 * module (`production.ts` defines it, for every guard), a reference in any
 * form — import, `import type`, re-export, `import()`, `require()` — that
 * reaches a test package, a test/spec/specification/fixtures module, ground,
 * the `specs/` tree or a contract, directly, through a `paths` alias or a
 * `#…` import, or through a module that is not production, is an error; so is
 * a path the module builds from where it sits (`new URL(…, import.meta.url)`,
 * `join(import.meta.dirname, …)`) or reads (`readFileSync('./…')`) into test
 * material.
 *
 * Sanctioned exception: `@jterrazz/test/oxlint`, the tool-facing, zero-runtime
 * lint entry (F1) — a shared oxlint preset legitimately imports it.
 *
 * This repository's runner coupling (I1) turns the rule off by path in its
 * own oxlint config.
 */
export const f2NoTestImportsInProd: LintRule = {
    create(context: RuleContext) {
        const file = context.physicalFilename;
        if (!isProductionModule(file)) {
            return {};
        }
        const here = dirname(file);
        let anchors = new Set<string>();
        const shown = (path: string): string => relative(here, path) || path;
        const reportPath = (node: AstNode, path: string, kind: MaterialKind): void => {
            context.report({ data: { kind, path: shown(path) }, messageId: 'pathRead', node });
        };
        const judgeAnchored = (node: AstNode): void => {
            const path = anchoredPath(node, here, anchors);
            const kind = path === undefined ? undefined : materialNamed(path);
            if (path !== undefined && kind !== undefined) {
                reportPath(node, path, kind);
            }
        };
        const references = moduleReferenceVisitor(({ node, source }) => {
            const reach = reachOf(file, source);
            if (reach === undefined) {
                return;
            }
            const what = reach.kind === 'a test package' ? reach.what : shown(reach.what);
            const data = { kind: reach.kind, source, what };
            if (reach.through.length > 0) {
                const through = reach.through.map((module) => shown(module)).join(' → ');
                context.report({ data: { ...data, through }, messageId: 'reachThrough', node });
            } else {
                context.report({ data, messageId: 'reach', node });
            }
        });
        const { CallExpression: referenceIn } = references;
        const visitor: Visitor = {
            ...references,
            CallExpression(node: AstNode) {
                referenceIn?.(node);
                judgeAnchored(node);
                const [first] = argumentsOf(node);
                const literal = stringValue(first);
                if (
                    FS_READ.test(calleeName(node) ?? '') &&
                    first !== undefined &&
                    literal !== undefined &&
                    /^\.\.?\//u.test(literal)
                ) {
                    const path = resolve(projectRootOf(here) ?? here, literal);
                    const kind = materialNamed(path);
                    if (kind !== undefined) {
                        reportPath(first, path, kind);
                    }
                }
            },
            NewExpression(node: AstNode) {
                const [target, base] = argumentsOf(node);
                const literal = stringValue(target);
                if (
                    identifierName(child(node, 'callee')) !== 'URL' ||
                    target === undefined ||
                    literal === undefined ||
                    !isImportMetaUrl(base)
                ) {
                    return;
                }
                const path = resolve(here, literal);
                const kind = materialNamed(path);
                if (kind !== undefined) {
                    reportPath(target, path, kind);
                }
            },
            Program(node: AstNode) {
                anchors = anchorsOf(node);
            },
            TemplateLiteral: judgeAnchored,
        };
        return visitor;
    },
    meta: {
        docs: RULE_DOCS['f2-no-test-imports-in-prod'],
        messages: lessons('f2-no-test-imports-in-prod', {
            pathRead: {
                found: 'production code names the path "{{path}}", {{kind}}',
                fix: 'move what production reads out of the test material, or have the caller hand it in',
            },
            reach: {
                found: 'production code references "{{source}}", {{kind}} ({{what}})',
                fix: 'move the reference into a test — specs, `*.test.ts`, `*.fixtures.ts` or `*.specification.ts` — or move what production needs out of the test material',
            },
            reachThrough: {
                found: 'production code references "{{source}}", which reaches {{kind}} ({{what}}) through {{through}}',
                fix: 'cut the edge that leaves production for test material: move what production needs out of it, or the reference into a test',
            },
        }),
        type: 'problem',
    },
};
