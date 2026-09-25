import type { Context } from '@oxlint/plugins';

import { segments } from '../../ast.js';
import { facetFileFindings } from '../../facet-file.js';
import { handleFileFindings } from '../../facet-handle.js';
import { lessonsAt } from '../../lesson.js';
import type { LintRule, Visitor } from '../../rule-shape.js';
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
        return {
            before: () => {
                file = facetFileOf(context.filename);
                return file !== undefined;
            },
            Program: (node) => {
                const findings =
                    file === 'composition' ? facetFileFindings(node) : handleFileFindings(node);
                for (const finding of findings) {
                    context.report(finding);
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
                    found: 'the engine `{{port}}` is a {{what}} written in the facet, not an adapter an engine module builds',
                    fix: 'name the adapter, or call the constructor its engine module exports — under `src/world/`, or in a concept folder of the facet — on the config alone',
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
                    fix: 'write `engines: (config) => ({ <port>: <adapter>, … })`, its parameter a bare name; what builds an adapter is its engine module',
                },
                inline: {
                    found: "the facet's `{{key}}` is a {{what}} written in the facet, not a reference imported from its module",
                    fix: 'import what the facet hands the kernel from the module that owns it, and name it here',
                },
                listed: {
                    found: '`{{key}}` lists a {{what}}, not a definition imported from a `*.capability.ts` or `*.action.ts` module',
                    fix: 'define the setup or the action in its own module, import it, and list it by its name',
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
                    fix: 'move the logic to the capability, the action or the engine that owns it; a facet file lists definitions and wires engines',
                },
            },
            SELF_CHAPTER,
        ),
        type: 'problem',
    },
};
