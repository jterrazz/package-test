import type { Context } from '@oxlint/plugins';

import { lessonsAt, rowNamed } from '../../../engine/catalogue/lesson.js';
import type { AstNode, Visitor } from '../../../engine/project/ast.js';
import { isFile } from '../../../engine/project/fs-cache.js';
import { isGroundName, SETUP_FOLDER, SHARED_FOLDER } from '../../../engine/project/ground.js';
import { specsAnchorOf } from '../../../engine/project/linted-file.js';
import type { LintRule } from '../../../engine/project/rule.js';
import { declaresTests } from '../../../engine/project/specs-modules.js';
import { CATALOGUE_CHAPTER } from '../../catalogue/chapter.js';
import { consumerRows } from '../../catalogue/manifest.js';
import { isStrayFolder } from './specs-at-declared-depth.first-level.js';

const NODE_TEST_SUFFIXES = ['.spec.ts', '.test.ts'];
const TEST_SUFFIX = '.test.ts';
const SPECIFICATION_SUFFIX = '.specification.ts';

function isNodeTest(base: string): boolean {
    return NODE_TEST_SUFFIXES.some((suffix) => base.endsWith(suffix));
}

function stemOf(base: string): string {
    const suffix = NODE_TEST_SUFFIXES.find((candidate) => base.endsWith(candidate));
    return suffix === undefined ? base : base.slice(0, -suffix.length);
}

/** There a `.spec.ts` sits as deep as its subject's name (`events/list/`, `db/migrate/`), which `spec-in-subject-folder` judges. */
const SUBJECT_PATH_FACETS = new Set(['api', 'cli']);

function sitsInASubjectPath(relative: string[], base: string): boolean {
    return base.endsWith('.spec.ts') && SUBJECT_PATH_FACETS.has(relative[0] ?? '');
}

export type SpecsDepth = 'facet' | 'facet-domain' | 'mirror' | 'off';

type Options = { depth?: SpecsDepth };

const DEFAULT_DEPTH: SpecsDepth = 'facet-domain';

/** `test-beside-its-module`'s pairing tells a ground module's test from a spec that wandered into the ground. */
function testsItsNeighbour(filename: string): boolean {
    return filename.endsWith(TEST_SUFFIX) && isFile(`${filename.slice(0, -TEST_SUFFIX.length)}.ts`);
}

export const specsAtDeclaredDepth: LintRule = {
    createOnce(context: Context): Visitor {
        return {
            before: () => specsAnchorOf(context) !== undefined,
            Program(node: AstNode) {
                const anchor = specsAnchorOf(context);
                if (anchor === undefined) {
                    return;
                }
                const depth = (context.options[0] as Options | undefined)?.depth ?? DEFAULT_DEPTH;
                const base = anchor.relative.at(-1) ?? '';
                if (!declaresTests(base) && isStrayFolder(anchor.directory, anchor.relative)) {
                    context.report({
                        data: { folder: anchor.relative[0] ?? '' },
                        messageId: 'strayFolder',
                        node,
                    });
                    return;
                }
                // `[facet, domain, …]`.
                const nesting = anchor.relative.length - 1;

                if (isNodeTest(base) || base.endsWith(SPECIFICATION_SUFFIX)) {
                    const folder = anchor.relative
                        .slice(0, -1)
                        .find((segment) => isGroundName(segment) || segment === SETUP_FOLDER);
                    if (folder !== undefined) {
                        if (!testsItsNeighbour(context.filename)) {
                            context.report({ data: { folder }, messageId: 'specInReserved', node });
                        }
                        // A ground module's test answers to `test-beside-its-module`, not to depth.
                        return;
                    }
                }
                const spec = isNodeTest(base) || base.endsWith(SPECIFICATION_SUFFIX);
                if (spec && nesting >= 1 && anchor.relative[0] === SHARED_FOLDER) {
                    context.report({ messageId: 'specInShared', node });
                    return;
                }
                if (base.endsWith(SPECIFICATION_SUFFIX)) {
                    if (nesting !== 1) {
                        context.report({ messageId: 'specNotAtFacetRoot', node });
                    }
                    return;
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
                    }
                    return;
                }

                if (depth === 'mirror') {
                    if (!isNodeTest(base)) {
                        return;
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
                }
            },
        };
    },
    meta: {
        defaultOptions: [{ depth: DEFAULT_DEPTH }],
        docs: rowNamed(consumerRows, 'specs-at-declared-depth'),
        messages: lessonsAt(
            rowNamed(consumerRows, 'specs-at-declared-depth'),
            {
                specInReserved: {
                    found: 'a spec under `{{folder}}/`, a reserved folder that is no subject',
                    fix: 'move the spec out of `{{folder}}/`, into the subject folder it specifies; a reserved folder that is code keeps only a `<module>.test.ts` next to its `<module>.ts`',
                },
                specInShared: {
                    found: 'a spec under `specs/_shared/`, the ground several leaves share',
                    fix: 'move it into its facet: `specs/_shared/` holds only `_setup/`, `_fixtures/`, `_seeds/`, `_requests/` and `_expected/`',
                },
                specNotAtFacetRoot: {
                    found: 'a `*.specification.ts` below its facet root',
                    fix: 'move it to `specs/<facet>/<name>.specification.ts`',
                },
                strayFolder: {
                    found: 'a module in `specs/{{folder}}/`, a first-level folder that is no facet, not `_shared/`, and holds no test of its own',
                    fix: 'move a runner to the root of the facet it builds (`specs/<facet>/<name>.specification.ts`), a test helper into the `_setup/` of the lowest folder its tests share, and a fixture under `specs/_shared/_fixtures/`; then remove `specs/{{folder}}/`',
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
            },
            CATALOGUE_CHAPTER,
        ),
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
