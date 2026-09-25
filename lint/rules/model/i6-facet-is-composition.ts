import type { Context } from '@oxlint/plugins';

import {
    chainRootName,
    child,
    childList,
    identifierName,
    memberPath,
    memberPropertyName,
    propertyKeyName,
    segments,
    stringValue,
} from '../../ast.js';
import { facetFileFindings, layerOf } from '../../facet-file.js';
import { lessonsAt } from '../../lesson.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';
import { SELF_CHAPTER, SELF_RULE_DOCS, selfRowOf } from '../../self-manifest.js';

/** What a facet's folder file is: its composition, its constructor, or neither. */
type FacetFile = 'composition' | 'constructor' | undefined;

/** `src/facets/<facet>/<facet>.facet.ts` is the composition, `<facet>.handle.ts` its constructor. */
function facetFileOf(filename: string): FacetFile {
    const [file = '', facet = '', facets = '', src = ''] = segments(filename).toReversed();
    if (src !== 'src' || facets !== 'facets') {
        return undefined;
    }
    if (file === `${facet}.facet.ts`) {
        return 'composition';
    }
    return file === `${facet}.handle.ts` ? 'constructor' : undefined;
}

/** A definition's own steps — what the chain runs, never its constructor. */
const STEPS = new Set(['arm', 'perform', 'reduce']);

/** The layer each name a constructor imports lives in, when it is one I6 judges. */
type Imported = ReadonlyMap<string, 'definition' | 'facet' | 'result'>;

/** A step of a definition, and what it is read off. */
type Step = { owner: string; step: string };

/** What a value is read off, when that is a definition or a facet the file imports. */
function composedOwner(node: AstNode | undefined, imported: Imported): string | undefined {
    const root = chainRootName(node);
    const layer = root === undefined ? undefined : imported.get(root);
    return layer === 'definition' || layer === 'facet' ? (memberPath(node) ?? root) : undefined;
}

/** The step a call runs, when it is one of a definition the file imports, or a step destructured from one. */
function stepRun(
    callee: AstNode | undefined,
    imported: Imported,
    bound: ReadonlyMap<string, Step>,
): Step | undefined {
    if (callee?.type === 'Identifier') {
        return bound.get(identifierName(callee) ?? '');
    }
    const step = callee === undefined ? undefined : memberPropertyName(callee);
    const owner = composedOwner(child(callee, 'object'), imported);
    return step !== undefined && STEPS.has(step) && owner !== undefined
        ? { owner, step }
        : undefined;
}

/** The steps a declarator destructures from a definition or a facet: `const { reduce } = seed`. */
function destructuredSteps(declarator: AstNode, imported: Imported): [string, Step][] {
    const owner = composedOwner(child(declarator, 'init'), imported);
    const pattern = child(declarator, 'id');
    if (owner === undefined || pattern?.type !== 'ObjectPattern') {
        return [];
    }
    return childList(pattern, 'properties').flatMap((property): [string, Step][] => {
        const step = propertyKeyName(property) ?? '';
        const local = identifierName(child(property, 'value'));
        return STEPS.has(step) && local !== undefined ? [[local, { owner, step }]] : [];
    });
}

/**
 * CONVENTIONS I6 — a facet file is a composition, and its constructor opens it.
 *
 * `src/facets/<facet>/<facet>.facet.ts` holds its imports, the `composition`,
 * the chain interface computed from it and the `defineFacet(…)` that wires
 * its engines; `<facet>.handle.ts` never runs a definition's step nor builds
 * a result. A `self` rule: these folders are this package's architecture.
 */
export const i6FacetIsComposition: LintRule = {
    createOnce(context: Context): Visitor {
        let file: FacetFile;
        const imported = new Map<string, 'definition' | 'facet' | 'result'>();
        const bound = new Map<string, Step>();
        return {
            before: () => {
                file = facetFileOf(context.filename);
                imported.clear();
                bound.clear();
                return file !== undefined;
            },
            CallExpression: (node) => {
                const run =
                    file === 'constructor'
                        ? stepRun(child(node, 'callee'), imported, bound)
                        : undefined;
                if (run !== undefined) {
                    context.report({ data: run, messageId: 'runsStep', node });
                }
            },
            ImportDeclaration: (node) => {
                const layer = layerOf(stringValue(child(node, 'source')) ?? '');
                for (const specifier of childList(node, 'specifiers')) {
                    const local = identifierName(child(specifier, 'local'));
                    if (layer !== undefined && local !== undefined) {
                        imported.set(local, layer);
                    }
                }
            },
            NewExpression: (node) => {
                const built = identifierName(child(node, 'callee'));
                if (
                    file === 'constructor' &&
                    built !== undefined &&
                    imported.get(built) === 'result'
                ) {
                    context.report({ data: { built }, messageId: 'buildsResult', node });
                }
            },
            Program: (node) => {
                if (file === 'composition') {
                    for (const finding of facetFileFindings(node)) {
                        context.report(finding);
                    }
                }
            },
            VariableDeclarator: (node) => {
                for (const [local, step] of destructuredSteps(node, imported)) {
                    bound.set(local, step);
                }
            },
        };
    },
    meta: {
        docs: SELF_RULE_DOCS['i6-facet-is-composition'],
        messages: lessonsAt(
            selfRowOf('i6-facet-is-composition'),
            {
                adapter: {
                    found: 'the engine `{{port}}` is a {{what}} written in the facet, not an adapter a seam builds',
                    fix: 'name the adapter, or call the constructor its seam under `src/seams/` exports, on the config alone',
                },
                buildsResult: {
                    found: 'the constructor builds a `{{built}}`, a result',
                    fix: 'let the action the chain ends on construct what it hands back; the constructor opens the facet (`<facet>Facet.open(config)`)',
                },
                defined: {
                    found: '`defineFacet` is handed a {{what}}, and it takes nothing but the chain type',
                    fix: 'write `defineFacet<Chain>()({ … })`: the facet object carries everything the facet composes',
                },
                engines: {
                    found: "the facet's `engines` is not an arrow handing back the object of its adapters",
                    fix: 'write `engines: (config) => ({ <port>: <adapter>, … })`, its parameter a bare name; what builds an adapter is its seam',
                },
                inline: {
                    found: "the facet's `{{key}}` is a {{what}} written in the facet, not a reference imported from its module",
                    fix: 'import what the facet hands the kernel from the module that owns it, and name it here',
                },
                listed: {
                    found: '`{{key}}` lists a {{what}}, not a definition imported from `capabilities/` or `actions/`',
                    fix: 'define the setup or the action in its own folder, import it, and list it by its name',
                },
                member: {
                    found: 'the composition holds `{{key}}`, which is none of its `capabilities`, `actions` or `options`',
                    fix: 'a composition lists definitions and the matrix rows of its options; move the rest to the module that owns it',
                },
                option: {
                    found: 'the option `{{name}}` is not a matrix row written as string literals',
                    fix: 'write the option as `{ group: …, name: …, probe: … }`, each a string literal',
                },
                runsStep: {
                    found: 'the constructor calls `{{owner}}.{{step}}()`, a step of a definition',
                    fix: 'open the facet (`<facet>Facet.open(config)`) and let the chain run the definitions it composes',
                },
                stray: {
                    found: 'a {{stray}} in a facet file, which holds its composition alone',
                    fix: 'move the logic to the capability, the action or the seam that owns it; a facet file lists definitions and wires engines',
                },
            },
            SELF_CHAPTER,
        ),
        type: 'problem',
    },
};
