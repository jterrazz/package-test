import {
    defineRule,
    isFile,
    isGroundFolder,
    readAt,
    rowNamed,
    SETUP_FOLDER,
} from '@jterrazz/typescript/rules';
import type { Context } from '@oxlint/plugins';

import { CATALOGUE_CHAPTER } from '../../../kit/catalogue/chapter.js';
import type { AstNode, Visitor } from '../../../kit/project/ast.js';
import { specsAnchorOf } from '../../../kit/project/linted-file.js';
import { declaresTests } from '../../../kit/project/specs-modules.js';
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
    // Stryker disable next-line ConditionalExpression: only a test's name is ever stemmed
    return suffix === undefined ? base : base.slice(0, -suffix.length);
}

/** There a `.spec.ts` sits as deep as its subject's name (`events/list/`, `db/migrate/`), which `spec-in-subject-folder` judges. */
const SUBJECT_PATH_SPECIFICATIONS = new Set(['api', 'cli']);

function sitsInASubjectPath(relative: string[], base: string): boolean {
    return base.endsWith('.spec.ts') && SUBJECT_PATH_SPECIFICATIONS.has(relative[0] ?? '');
}

const SPECS_DEPTHS = ['specification', 'specification-domain', 'mirror', 'off'] as const;

export type SpecsDepth = (typeof SPECS_DEPTHS)[number];

function depthOf(option: unknown): SpecsDepth | undefined {
    // Stryker disable ConditionalExpression: the schema admits only an object
    const depth: unknown =
        typeof option === 'object' && option !== null && 'depth' in option
            ? option.depth
            : undefined;
    // Stryker restore ConditionalExpression
    return SPECS_DEPTHS.find((known) => known === depth);
}

const DEFAULT_DEPTH: SpecsDepth = 'specification-domain';

/** A module’s test beside it — a specs tree holds no `__tests__/` — tells a ground module’s test from a spec that wandered into the ground. */
function testsItsNeighbour(filename: string): boolean {
    return filename.endsWith(TEST_SUFFIX) && isFile(`${filename.slice(0, -TEST_SUFFIX.length)}.ts`);
}

const MESSAGES = {
    specInReserved: {
        found: 'a spec under `{{folder}}/`, a reserved folder that is no subject',
        fix: 'move the spec out of `{{folder}}/`, into the subject folder it specifies; a reserved folder that is code keeps only a `<module>.test.ts` next to its `<module>.ts`',
    },
    specNotAtSpecificationRoot: {
        found: 'a `*.specification.ts` below its specification root',
        fix: 'move it to `specs/<specification>/<name>.specification.ts`',
    },
    strayFolder: {
        found: 'a module in `specs/{{folder}}/`, a first-level folder that is no specification, no special folder, and holds no test of its own',
        fix: 'move a runner to the root of the specification it builds (`specs/<specification>/<name>.specification.ts`), a test helper into the `__setup__/` of the lowest folder its tests share, and a fixture in the ground of the lowest folder its tests share (`specs/__fixtures__/` across specifications); then remove `specs/{{folder}}/`',
    },
    testAtSpecificationRoot: {
        found: 'a spec directly at its specification root',
        fix: 'move it into a domain folder: `specs/<specification>/<domain>/<aspect>.spec.ts`',
    },
    testAtSpecsRoot: {
        found: 'a spec at the specs root, under `depth: "mirror"`',
        fix: 'move it into the directory it mirrors',
    },
    testNotMirroringDirectory: {
        found: 'a spec not named after its directory, under `depth: "mirror"`',
        fix: 'rename it `{{directory}}/{{directory}}.spec.ts`',
    },
    testOutsideSpecification: {
        found: 'a spec outside every specification folder, under `depth: "specification"`',
        fix: 'move it to `specs/<specification>/<aspect>.spec.ts`, or one domain deeper',
    },
    testTooDeep: {
        found: 'a spec nested below its domain folder',
        fix: 'move it up to `specs/<specification>/<domain>/<aspect>.spec.ts`',
    },
    testTooDeepForSpecification: {
        found: 'a spec more than one folder below its specification, under `depth: "specification"`',
        fix: 'move it to `specs/<specification>/<aspect>.spec.ts` or `specs/<specification>/<domain>/<aspect>.spec.ts`',
    },
};

type Verdict = null | { data?: Record<string, string>; messageId: keyof typeof MESSAGES };

type Placement = { base: string; filename: string; nesting: number; relative: string[] };

function reservedVerdict(placement: Placement): undefined | Verdict {
    const { base, filename, relative } = placement;
    if (!isNodeTest(base) && !base.endsWith(SPECIFICATION_SUFFIX)) {
        return undefined;
    }
    // Stryker disable next-line MethodExpression: a test's own name is never a reserved folder's
    const folder = relative
        .slice(0, -1)
        .find((segment) => isGroundFolder(segment) || segment === SETUP_FOLDER);
    if (folder === undefined) {
        return undefined;
    }
    // invariant: a ground module's test answers to `test-in-its-tests-folder`, not to depth.
    return testsItsNeighbour(filename) ? null : { data: { folder }, messageId: 'specInReserved' };
}

function specificationVerdict({ base, nesting, relative }: Placement): Verdict {
    if (!isNodeTest(base)) {
        return null;
    }
    if (nesting < 1) {
        return { messageId: 'testOutsideSpecification' };
    }
    return nesting > 2 && !sitsInASubjectPath(relative, base)
        ? { messageId: 'testTooDeepForSpecification' }
        : null;
}

function mirrorVerdict({ base, nesting, relative }: Placement): Verdict {
    if (!isNodeTest(base)) {
        return null;
    }
    if (nesting < 1) {
        return { messageId: 'testAtSpecsRoot' };
    }
    const directory = relative.at(-2) ?? '';
    return stemOf(base) === directory
        ? null
        : { data: { directory }, messageId: 'testNotMirroringDirectory' };
}

function specificationDomainVerdict({ base, nesting, relative }: Placement): Verdict {
    if (!isNodeTest(base)) {
        return null;
    }
    if (nesting < 2) {
        return { messageId: 'testAtSpecificationRoot' };
    }
    return nesting > 2 && !sitsInASubjectPath(relative, base) ? { messageId: 'testTooDeep' } : null;
}

const DEPTH_VERDICTS: Record<SpecsDepth, (placement: Placement) => Verdict> = {
    specification: specificationVerdict,
    'specification-domain': specificationDomainVerdict,
    mirror: mirrorVerdict,
    off: () => null,
};

function verdictOf(placement: Placement, directory: string, depth: SpecsDepth): Verdict {
    const { base, nesting, relative } = placement;
    if (!declaresTests(base) && isStrayFolder(directory, relative)) {
        // Stryker disable next-line LogicalOperator: a stray folder always has a name
        return { data: { folder: relative[0] ?? '' }, messageId: 'strayFolder' };
    }
    const reserved = reservedVerdict(placement);
    if (reserved !== undefined) {
        return reserved;
    }
    if (base.endsWith(SPECIFICATION_SUFFIX)) {
        return nesting === 1 ? null : { messageId: 'specNotAtSpecificationRoot' };
    }
    return DEPTH_VERDICTS[depth](placement);
}

const row = rowNamed(consumerRows, 'specs-at-declared-depth');

export const specsAtDeclaredDepth = defineRule(
    {
        defaultOptions: [{ depth: DEFAULT_DEPTH }],
        docs: row,
        messages: MESSAGES,
        read: readAt(row, CATALOGUE_CHAPTER),
        schema: [
            {
                additionalProperties: false,
                properties: {
                    depth: {
                        enum: ['specification', 'specification-domain', 'mirror', 'off'],
                        type: 'string',
                    },
                },
                type: 'object',
            },
        ],
        type: 'problem',
    },
    {
        createOnce(context: Context): Visitor {
            return {
                // Stryker disable ArrowFunction,ConditionalExpression: `Program` reads the anchor again, and returns where there is none
                before: () => specsAnchorOf(context) !== undefined,
                Program(node: AstNode) {
                    const anchor = specsAnchorOf(context);
                    // Stryker restore ArrowFunction,ConditionalExpression
                    // Stryker disable next-line ConditionalExpression: `before` found the anchor
                    if (anchor === undefined) {
                        return;
                    }
                    const placement: Placement = {
                        base: anchor.relative.at(-1) ?? '',
                        filename: context.filename,
                        // invariant: `[specification, domain, …]`.
                        nesting: anchor.relative.length - 1,
                        relative: anchor.relative,
                    };
                    const depth = depthOf(context.options[0]) ?? DEFAULT_DEPTH;
                    const verdict = verdictOf(placement, anchor.directory, depth);
                    if (verdict !== null) {
                        context.report({ ...verdict, node });
                    }
                },
            };
        },
    },
);
