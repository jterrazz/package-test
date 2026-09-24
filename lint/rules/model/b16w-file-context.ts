import {
    child,
    childList,
    identifierName,
    memberPropertyName,
    nodeEnd,
    nodeStart,
    stringValue,
    walk,
} from '../../ast.js';
import { lessons } from '../../lesson.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, Fix, LintRule, RuleContext, RuleFixer, Visitor } from '../../oxlint-api.js';
import { roleOf } from '../../role.js';
import { subjectFolder, subjectsOf } from '../../subject.js';
import type { Subject } from '../../subject.js';

/** The settings a facet's `with()` takes — what a whole file may share. */
const SETTINGS: Record<string, readonly string[]> = {
    api: ['clock', 'headers'],
    cli: ['env'],
    integration: ['clock'],
    jobs: ['clock'],
    website: ['clock', 'headers'],
};

/** One setup call of a chain: its name, its argument's source, and the span `.name(…)` takes. */
type Setting = { argument: string; end: number; name: string; start: number };

/** A chain off a handle: its root identifier, its outermost call, and its settings. */
type Chain = { end: number; handle: string; root: AstNode; settings: Setting[]; start: number };

/** The runner handles a spec imports from a specification module, by their names. */
function handlesOf(program: AstNode): Set<string> {
    const handles = new Set<string>();
    for (const statement of childList(program, 'body')) {
        const source = stringValue(child(statement, 'source')) ?? '';
        if (
            statement.type !== 'ImportDeclaration' ||
            !/\.specification(?:\.[jt]s)?$/u.test(source)
        ) {
            continue;
        }
        for (const specifier of childList(statement, 'specifiers')) {
            const name = identifierName(child(specifier, 'local'));
            if (name !== undefined && name in SETTINGS) {
                handles.add(name);
            }
        }
    }
    return handles;
}

/** The chain a call ends, when it hangs off a handle: its root and its setup calls, outermost last. */
function chainOf(call: AstNode, handles: Set<string>, text: string): Chain | undefined {
    const settings: Setting[] = [];
    let current: AstNode | undefined = call;
    while (current?.type === 'CallExpression') {
        const callee = child(current, 'callee');
        const object = child(callee, 'object');
        const name = callee?.type === 'MemberExpression' ? memberPropertyName(callee) : undefined;
        const [argument] = childList(current, 'arguments');
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

/** Every chain of the file, each by its outermost call — a call inside another chain's span is part of it. */
function chainsOf(program: AstNode, handles: Set<string>, text: string): Chain[] {
    const chains: Chain[] = [];
    walk(program, (node) => {
        if (node.type !== 'CallExpression') {
            return;
        }
        const chain = chainOf(node, handles, text);
        if (chain === undefined) {
            return;
        }
        const outer = chains.findIndex(
            (known) => known.start === chain.start && known.end >= chain.end,
        );
        if (outer === -1) {
            chains.push(chain);
        }
    });
    return chains;
}

/** The settings every chain of the file states alike — the same name, the same argument. */
function sharedSettings(chains: Chain[]): Setting[] {
    const [first, ...rest] = chains;
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

/** The actions a route's folder ends on — never the name of what it acts on. */
const ACTIONS = new Set(['create', 'delete', 'get', 'list', 'update']);

/** A kebab or path word in camelCase: `report-refresh` → `reportRefresh`. */
function camelOf(word: string): string {
    return word.replaceAll(/[-_.](?<letter>[a-z0-9])/gu, (_, letter: string) =>
        letter.toUpperCase(),
    );
}

/**
 * The word a subject is called by: the resource a route's folder ends on
 * (`events/list/` → `events`, `indicators/chart/` → `chart`), the job, the
 * command's first word — `undefined` for a subject with no standard name.
 */
function subjectWord(subject: Subject): string | undefined {
    if (subject.facet === 'jobs') {
        return subject.job;
    }
    if (subject.facet === 'cli') {
        return subject.command[0];
    }
    const folder = subjectFolder(subject)?.split('/') ?? [];
    return folder.findLast((segment) => !ACTIONS.has(segment));
}

/**
 * The name the view takes: the file's subject — so every file of one folder
 * names its view alike — `<subject>View` when the file already holds that
 * name, and `<handle>InFile` for a file whose chains reach no named subject.
 */
function viewName(handle: string, text: string, program: AstNode): string {
    const taken = new Set<string>();
    walk(program, (node) => {
        const name = identifierName(node);
        if (name !== undefined) {
            taken.add(name);
        }
    });
    const free = (name: string): boolean =>
        /^[a-z][A-Za-z0-9]*$/u.test(name) && name !== handle && !taken.has(name);
    const reached = subjectsOf(text).find(({ subject }) => subject.facet === handle)?.subject;
    const word = reached === undefined ? undefined : subjectWord(reached);
    if (word === undefined) {
        return `${handle}InFile`;
    }
    const name = camelOf(word);
    return free(name) ? name : `${name}View`;
}

/** The edits that declare the view once and start every chain from it, its shared settings dropped. */
function declareOnce(
    fixer: RuleFixer,
    {
        chains,
        program,
        shared,
        text,
        view,
    }: { chains: Chain[]; program: AstNode; shared: Setting[]; text: string; view: string },
): Fix[] {
    const handle = chains[0]?.handle ?? '';
    const imports = childList(program, 'body').filter(
        (statement) => statement.type === 'ImportDeclaration',
    );
    const after = nodeEnd(imports.at(-1));
    const context = shared.map((setting) => `${setting.name}: ${setting.argument}`).join(', ');
    const edits: Fix[] = [
        fixer.insertTextAfterRange(
            [after, after],
            `\n\nconst ${view} = ${handle}.with({ ${context} });`,
        ),
    ];
    for (const chain of chains) {
        const dropped = chain.settings.filter((setting) =>
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

/**
 * CONVENTIONS B16w — a setting every chain of a spec file states alike (the
 * same `.clock(…)`, the same `.headers(…)`, the same `.env(…)`) is the file's,
 * stated once: `const events = api.with({ clock: '…' })`. Reported at the
 * first chain's setting; `--fix` declares the view after the imports, starts
 * every chain from it, and drops the setting from each.
 *
 * A warning: two chains alike may be a coincidence the next test breaks.
 */
export const b16wFileContext: LintRule = {
    create(context: RuleContext): Visitor {
        if (roleOf(context.filename).role !== 'spec') {
            return {};
        }
        return {
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
                        fix: (fixer) => declareOnce(fixer, { chains, program, shared, text, view }),
                        messageId: 'repeated',
                        node: chains[0]?.root,
                    });
                }
            },
        };
    },
    meta: {
        docs: RULE_DOCS['b16w-file-context'],
        fixable: 'code',
        messages: lessons('b16w-file-context', {
            repeated: {
                found: 'all {{count}} chains of this file state `{{setting}}` alike',
                fix: 'state it once for the file — `const {{view}} = {{handle}}.with({ {{context}} })` — and start every chain from `{{view}}`; `make fix` writes it',
            },
        }),
        type: 'suggestion',
    },
};
