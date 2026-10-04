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
    stringValue,
    walk,
} from '../../../kit/project/ast.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { identityOf } from '../../../kit/project/linted-file.js';
import { subjectFolder, subjectsOf } from '../../../kit/project/subject.js';
import type { Subject } from '../../../kit/project/subject.js';
import { consumerRows } from '../../catalogue/manifest.js';

const SETTINGS: Record<string, readonly string[]> = {
    api: ['clock', 'headers'],
    cli: ['env'],
    integration: ['clock'],
    job: ['clock'],
    website: ['clock', 'headers'],
};

type Setting = { argument: string; end: number; name: string; start: number };

type Chain = { end: number; handle: string; root: AstNode; settings: Setting[]; start: number };

function handlesOf(program: AstNode): Set<string> {
    const handles = new Set<string>();
    for (const statement of childList(program, 'body')) {
        // Stryker disable next-line StringLiteral: a statement with no source fails the pattern as an empty one does
        const source = stringValue(child(statement, 'source')) ?? '';
        if (
            statement.type !== 'ImportDeclaration' ||
            !/\.specification(?:\.[jt]s)?$/u.test(source)
        ) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            const name = identifierName(child(specifier, 'local'));
            // Stryker disable next-line ConditionalExpression,LogicalOperator: an import's local name is always read, and a handle no facet sets is allowed no setting below
            if (name !== undefined && name in SETTINGS) {
                handles.add(name);
            }
        }
    }
    return handles;
}

/** Setup calls outermost last. */
function chainOf(call: AstNode, handles: Set<string>, text: string): Chain | undefined {
    // Stryker disable next-line ArrayDeclaration: an entry that is no setting is no allowed one
    const settings: Setting[] = [];
    let current: AstNode | undefined = call;
    while (current?.type === 'CallExpression') {
        const callee = child(current, 'callee');
        const object = child(callee, 'object');
        // Stryker disable next-line ConditionalExpression,OptionalChaining: a call always has a callee, and memberPropertyName reads none from a non-member
        const name = callee?.type === 'MemberExpression' ? memberPropertyName(callee) : undefined;
        const [argument] = childList(current, 'arguments');
        // Stryker disable next-line ConditionalExpression: a setting with no name is no setting a facet allows
        if (name !== undefined && argument !== undefined) {
            settings.unshift({
                argument: text.slice(nodeStart(argument), nodeEnd(argument)),
                end: nodeEnd(current),
                name,
                start: nodeEnd(object),
            });
        }
        current = object;
    }
    const handle = identifierName(current);
    // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement: the three are one check, that the chain starts at an imported runner, spelled for the type checker
    if (current === undefined || handle === undefined || !handles.has(handle)) {
        return undefined;
    }
    const allowed = SETTINGS[handle] ?? [];
    return {
        end: nodeEnd(call),
        handle,
        root: current,
        settings: settings.filter((setting) => allowed.includes(setting.name)),
        start: nodeStart(current),
    };
}

function chainsOf(program: AstNode, handles: Set<string>, text: string): Chain[] {
    // Stryker disable next-line ArrayDeclaration: an entry that is no chain belongs to no handle
    const chains: Chain[] = [];
    walk(program, (node) => {
        if (node.type !== 'CallExpression') {
            return;
        }
        const chain = chainOf(node, handles, text);
        if (chain === undefined) {
            return;
        }
        // invariant: the walk meets a chain's outermost call first, so a later call starting where it starts is one of its links.
        if (!chains.some((known) => known.start === chain.start)) {
            chains.push(chain);
        }
    });
    return chains;
}

function sharedSettings(chains: Chain[]): Setting[] {
    const [first, ...rest] = chains;
    // Stryker disable next-line ConditionalExpression: no chain leaves no rest either
    if (first === undefined || rest.length === 0) {
        return [];
    }
    return first.settings.filter((setting) =>
        rest.every((chain) =>
            chain.settings.some(
                (other) => other.name === setting.name && other.argument === setting.argument,
            ),
        ),
    );
}

const ACTIONS = new Set(['create', 'delete', 'get', 'list', 'update']);

/** `report-refresh` → `reportRefresh`. */
function camelOf(word: string): string {
    return word.replaceAll(/[-_.](?<letter>[a-z0-9])/gu, (_, letter: string) =>
        letter.toUpperCase(),
    );
}

/** `events/list/` → `events`, `indicators/chart/` → `chart`; `undefined` for a subject with no standard name. */
function subjectWord(subject: Subject): string | undefined {
    if (subject.facet === 'job') {
        return subject.job;
    }
    if (subject.facet === 'cli') {
        return subject.command[0];
    }
    // Stryker disable next-line ArrayDeclaration: a word holding a space is no name, and leaves the view named for the file
    const folder = subjectFolder(subject)?.split('/') ?? [];
    return folder.findLast((segment) => !ACTIONS.has(segment));
}

/** Every file of one folder names its view alike: `<subject>View` when the file already holds that name, `<handle>InFile` when no subject a name can be made of is reached. */
function viewName(handle: string, text: string, program: AstNode): string {
    const taken = new Set<string>();
    walk(program, (node) => {
        const name = identifierName(node);
        // Stryker disable next-line ConditionalExpression: undefined is no name a view could take
        if (name !== undefined) {
            taken.add(name);
        }
    });
    const reached = subjectsOf(text).find(({ subject }) => subject.facet === handle)?.subject;
    const word = reached === undefined ? undefined : subjectWord(reached);
    // Stryker disable next-line StringLiteral: no word fails the pattern below as any non-name does
    const name = word === undefined ? '' : camelOf(word);
    // Stryker disable next-line Regex: camelOf leaves letters and digits, so a name starting with a letter holds nothing else
    if (!/^[a-z][A-Za-z0-9]*$/u.test(name)) {
        return `${handle}InFile`;
    }
    return taken.has(name) ? `${name}View` : name;
}

/** Only a variable declaration holds `declarations`: any other statement declares no name a setting reads. */
function declaredNames(statement: AstNode): string[] {
    const declaration =
        statement.type === 'ExportNamedDeclaration' ? child(statement, 'declaration') : statement;
    return childList(declaration, 'declarations').flatMap(
        (declarator) => identifierName(child(declarator, 'id')) ?? [],
    );
}

/** After the imports, and after every top-level declaration a shared setting reads: a view declared above a constant it reads is read before it exists. */
function viewPosition(program: AstNode, shared: Setting[]): number {
    const read = new Set(
        shared.flatMap((setting) => setting.argument.match(/[A-Za-z_$][\w$]*/gu) ?? []),
    );
    let after = 0;
    for (const statement of childList(program, 'body')) {
        if (
            statement.type === 'ImportDeclaration' ||
            declaredNames(statement).some((name) => read.has(name))
        ) {
            after = nodeEnd(statement);
        }
    }
    return after;
}

function declareOnce(
    fixer: Fixer,
    {
        chains,
        handle,
        program,
        shared,
        text,
        view,
    }: {
        chains: Chain[];
        handle: string;
        program: AstNode;
        shared: Setting[];
        text: string;
        view: string;
    },
): Fix[] {
    const after = viewPosition(program, shared);
    const context = shared.map((setting) => `${setting.name}: ${setting.argument}`).join(', ');
    const edits: Fix[] = [
        fixer.insertTextAfterRange(
            [after, after],
            `\n\nconst ${view} = ${handle}.with({ ${context} });`,
        ),
    ];
    for (const chain of chains) {
        const dropped = chain.settings.filter((setting) =>
            // Stryker disable next-line ConditionalExpression: a chain states each setting once, so a shared name's argument is the shared one
            shared.some((own) => own.name === setting.name && own.argument === setting.argument),
        );
        let rest = text.slice(nodeEnd(chain.root), chain.end);
        for (const setting of dropped.toReversed()) {
            const from = setting.start - nodeEnd(chain.root);
            rest = rest.slice(0, from) + rest.slice(setting.end - nodeEnd(chain.root));
        }
        edits.push(fixer.replaceTextRange([chain.start, chain.end], `${view}${rest}`));
    }
    return edits;
}

const row = rowNamed(consumerRows, 'no-repeated-chain-setting');

export const noRepeatedChainSetting = defineRule(
    {
        docs: row,
        fixable: 'code',
        messages: {
            repeated: {
                found: 'all {{count}} chains of this file state `{{setting}}` alike',
                fix: 'state it once for the file — `const {{view}} = {{handle}}.with({ {{context}} })` — and start every chain from `{{view}}`; `typescript fix` writes it',
            },
        },
        read: readAt(row, CATALOGUE_CHAPTER),
        type: 'suggestion',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                before: () => identityOf(context).role === 'spec',
                Program(program: AstNode) {
                    const handles = handlesOf(program);
                    const { text } = context.sourceCode;
                    for (const handle of handles) {
                        const chains = chainsOf(program, handles, text).filter(
                            (chain) => chain.handle === handle,
                        );
                        const shared = sharedSettings(chains);
                        const [first] = shared;
                        if (first === undefined) {
                            continue;
                        }
                        const view = viewName(handle, text, program);
                        context.report({
                            data: {
                                context: shared
                                    .map((setting) => `${setting.name}: ${setting.argument}`)
                                    .join(', '),
                                count: chains.length,
                                handle,
                                setting: `.${first.name}(${first.argument})`,
                                view,
                            },
                            fix: (fixer) =>
                                declareOnce(fixer, { chains, handle, program, shared, text, view }),
                            messageId: 'repeated',
                            // Stryker disable next-line OptionalChaining: a shared setting means two chains at least
                            node: chains[0]?.root ?? program,
                        });
                    }
                },
            };
        },
    },
);
