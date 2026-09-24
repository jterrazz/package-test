import type { Context } from '@oxlint/plugins';

import { isGroundName } from '../../../src/model/chain/ground.js';
import { isFile } from '../../fs-cache.js';
import { lessons } from '../../lesson.js';
import { specsAnchorOf } from '../../linted-file.js';
import { RULE_DOCS } from '../../manifest.js';
import type { AstNode, LintRule, Visitor } from '../../rule-shape.js';

/** The two node suffixes a spec tree collects — `.test.ts` beside ground code, `.spec.ts` for the product. */
const NODE_TEST_SUFFIXES = ['.spec.ts', '.test.ts'];
const TEST_SUFFIX = '.test.ts';
const SPECIFICATION_SUFFIX = '.specification.ts';

/** Does this basename end in one of the two node test suffixes? */
function isNodeTest(base: string): boolean {
    return NODE_TEST_SUFFIXES.some((suffix) => base.endsWith(suffix));
}

/** The basename with whichever node test suffix it carries removed. */
function stemOf(base: string): string {
    const suffix = NODE_TEST_SUFFIXES.find((candidate) => base.endsWith(candidate));
    return suffix === undefined ? base : base.slice(0, -suffix.length);
}

/**
 * The facets whose subject's standard name may take several folders — a
 * route's resource and action (`events/list/`), a command's words
 * (`db/migrate/`). There a `.spec.ts` sits as deep as its subject's name,
 * which C30 derives and judges.
 */
const SUBJECT_PATH_FACETS = new Set(['api', 'cli']);

/** Is this a spec the subject's name may place below one domain folder? */
function sitsInASubjectPath(relative: string[], base: string): boolean {
    return base.endsWith('.spec.ts') && SUBJECT_PATH_FACETS.has(relative[0] ?? '');
}

/** The shapes a spec tree may declare. */
export type SpecsDepth = 'facet' | 'facet-domain' | 'mirror' | 'off';

type Options = { depth?: SpecsDepth };

const DEFAULT_DEPTH: SpecsDepth = 'facet-domain';

/**
 * Whether a file is the unit test of the module it sits beside — `x.test.ts`
 * next to `x.ts`, which is the whole of I2's pairing. This is what tells a
 * ground MODULE's test from a spec that wandered into the ground.
 */
function testsItsNeighbour(filename: string): boolean {
    return filename.endsWith(TEST_SUFFIX) && isFile(`${filename.slice(0, -TEST_SUFFIX.length)}.ts`);
}

/**
 * CONVENTIONS C1' — the shape of a spec tree, DECLARED by the consumer.
 *
 * A project states which shape its `specs/` tree has; the rule checks that one.
 * Before this option there was a single shape and the only way out was `off`,
 * which took the whole rule with it — a tree with a different, equally
 * deliberate shape had no way to be checked at all.
 *
 * `depth: 'facet-domain'` (the default, and the historical behaviour)
 *
 * A facet (`specs/<facet>/` — api, jobs, cli, integrations, lint, …) is the
 * master folder. It carries its runner(s) at its ROOT
 * (`specs/<facet>/<name>.specification.ts`) and holds DOMAIN folders, each a
 * product command/area with one or more `<aspect>.test.ts` files plus their
 * shared asset dirs.
 *
 * - a spec sits at facet/domain depth — exactly
 *   `specs/<facet>/<domain>/<aspect>.spec.ts`. A test directly at the facet root
 *   (or nested deeper than a domain) is rejected — but for a `.spec.ts` of the
 *   api and cli facets, whose domain is its subject's standard name and may
 *   take several folders (`events/list/`, `db/migrate/`): C30 judges which.
 * - a `*.specification.ts` sits at the facet root — exactly
 *   `specs/<facet>/<file>.specification.ts`, never inside a domain.
 *
 * `depth: 'facet'`
 *
 * The same facet root, one degree looser: the folder follows the assets. A
 * spec sits EITHER at the facet root (`specs/<facet>/<aspect>.spec.ts`)
 * or one domain folder down (`specs/<facet>/<domain>/<aspect>.spec.ts`) — a
 * test earns a domain folder when it carries assets of its own, and sits
 * beside its siblings when it does not. Anything deeper is rejected, and so is
 * a test loose at the specs root. A `*.specification.ts` sits at the facet
 * root, exactly as in `facet-domain`.
 *
 * `depth: 'mirror'`
 *
 * The tree mirrors something outside itself (a command tree, a source tree), so
 * the depth is that structure's and no fixed number can name it. A spec
 * sits at ANY depth of at least one directory under `specs/`, and is NAMED
 * AFTER the directory holding it — `<dir>/<dir>.spec.ts`, the suffix C12 gives
 * every file of a facet tree. That naming is what
 * keeps the shape checkable: one test per mirrored node, no test loose at the
 * specs root. Specification files are unconstrained: a mirror has no facet
 * level to anchor them to.
 *
 * `depth: 'off'` — no DEPTH check; the tree's shape is guarded elsewhere.
 *
 * The ground clause holds in every mode, `off` included: a directory named
 * `fixtures/`, `expected/`, `requests/` or `seeds/` is ground — what the specs of
 * a row stand on — and never a facet, domain or suite folder, so no SPEC may live
 * inside one: a domain named with a reserved word is refused here. That is not a
 * question of depth, which is why no project's declared shape switches it off.
 *
 * Ground is not always inert, though: it may be CODE the specs stand on — the
 * build of the subject under test, a harness the runner spawns. A `<module>.ts`
 * there keeps its own unit test under I2's law, `<module>.test.ts` NEXT to it,
 * and the clause lets that one pair through. Nothing else: a test with no module
 * beside it, or a `*.specification.ts`, is a spec that wandered into the ground.
 *
 * Module tests under `src/` follow the neighbour rule (I2) and are out of scope
 * in every mode.
 */
export const c1DomainStructure: LintRule = {
    create(context: Context): Visitor {
        const depth = (context.options[0] as Options | undefined)?.depth ?? DEFAULT_DEPTH;
        return {
            Program(node: AstNode) {
                const anchor = specsAnchorOf(context);
                if (anchor === undefined) {
                    return;
                }
                const base = anchor.relative.at(-1) ?? '';
                // Segments strictly between `specs` and the file: [facet, domain, …].
                const nesting = anchor.relative.length - 1;

                if (isNodeTest(base) || base.endsWith(SPECIFICATION_SUFFIX)) {
                    const ground = anchor.relative
                        .slice(0, -1)
                        .find((segment) => isGroundName(segment));
                    if (ground !== undefined) {
                        if (!testsItsNeighbour(context.filename)) {
                            context.report({ data: { ground }, messageId: 'specInGround', node });
                        }
                        // A ground module's test answers to I2, not to depth.
                        return;
                    }
                }
                if (depth === 'off') {
                    return;
                }

                if (depth === 'facet') {
                    if (isNodeTest(base)) {
                        if (nesting < 1) {
                            context.report({ messageId: 'testOutsideFacet', node });
                        } else if (nesting > 2 && !sitsInASubjectPath(anchor.relative, base)) {
                            context.report({ messageId: 'testTooDeepForFacet', node });
                        }
                        return;
                    }
                    if (base.endsWith(SPECIFICATION_SUFFIX) && nesting !== 1) {
                        context.report({ messageId: 'specNotAtFacetRoot', node });
                    }
                    return;
                }

                if (depth === 'mirror') {
                    if (!isNodeTest(base)) {
                        return; // A mirror constrains its tests, nothing else.
                    }
                    if (nesting < 1) {
                        context.report({ messageId: 'testAtSpecsRoot', node });
                        return;
                    }
                    const directory = anchor.relative.at(-2) ?? '';
                    if (stemOf(base) !== directory) {
                        context.report({
                            data: { directory },
                            messageId: 'testNotMirroringDirectory',
                            node,
                        });
                    }
                    return;
                }

                if (isNodeTest(base)) {
                    if (nesting < 2) {
                        context.report({ messageId: 'testAtFacetRoot', node });
                    } else if (nesting > 2 && !sitsInASubjectPath(anchor.relative, base)) {
                        context.report({ messageId: 'testTooDeep', node });
                    }
                    return;
                }
                if (base.endsWith(SPECIFICATION_SUFFIX)) {
                    if (nesting !== 1) {
                        context.report({ messageId: 'specNotAtFacetRoot', node });
                    }
                }
            },
        };
    },
    meta: {
        defaultOptions: [{ depth: DEFAULT_DEPTH }],
        docs: RULE_DOCS['c1-domain-structure'],
        messages: lessons('c1-domain-structure', {
            specInGround: {
                found: 'a spec under `{{ground}}/`, a reserved ground name',
                fix: 'move the spec out of `{{ground}}/` (rename a domain that took the name); ground that is code keeps only a `<module>.test.ts` next to its `<module>.ts`',
            },
            specNotAtFacetRoot: {
                found: 'a `*.specification.ts` below its facet root',
                fix: 'move it to `specs/<facet>/<name>.specification.ts`',
            },
            testAtFacetRoot: {
                found: 'a spec directly at its facet root',
                fix: 'move it into a domain folder: `specs/<facet>/<domain>/<aspect>.spec.ts`',
            },
            testAtSpecsRoot: {
                found: 'a spec at the specs root, under `depth: "mirror"`',
                fix: 'move it into the directory it mirrors',
            },
            testNotMirroringDirectory: {
                found: 'a spec not named after its directory, under `depth: "mirror"`',
                fix: 'rename it `{{directory}}/{{directory}}.spec.ts`',
            },
            testOutsideFacet: {
                found: 'a spec outside every facet folder, under `depth: "facet"`',
                fix: 'move it to `specs/<facet>/<aspect>.spec.ts`, or one domain deeper',
            },
            testTooDeep: {
                found: 'a spec nested below its domain folder',
                fix: 'move it up to `specs/<facet>/<domain>/<aspect>.spec.ts`',
            },
            testTooDeepForFacet: {
                found: 'a spec more than one folder below its facet, under `depth: "facet"`',
                fix: 'move it to `specs/<facet>/<aspect>.spec.ts` or `specs/<facet>/<domain>/<aspect>.spec.ts`',
            },
        }),
        schema: [
            {
                additionalProperties: false,
                properties: {
                    depth: { enum: ['facet', 'facet-domain', 'mirror', 'off'], type: 'string' },
                },
                type: 'object',
            },
        ],
        type: 'problem',
    },
};
