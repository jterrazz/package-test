import { readSettings } from '@jterrazz/typescript/rules';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration, ViteUserConfig } from 'vitest/config';

import { derivedProjects } from '../lint/kit/project/derived-projects.js';
import { isRecord } from '../lint/kit/project/json-shape.js';
import { TEST_SECTION } from '../lint/kit/project/test-section.js';
import { refusal } from './chain/refusals/refusal.js';
import { api } from './specifications/api/api.project.js';
import { cli } from './specifications/cli/cli.project.js';
import { component } from './specifications/component/component.project.js';
import { deployment } from './specifications/deployment/deployment.project.js';
import { integration } from './specifications/integration/integration.project.js';
import { job } from './specifications/job/job.project.js';
import { lint } from './specifications/lint/lint.project.js';
import { mobile } from './specifications/mobile/mobile.project.js';
import { website } from './specifications/website/website.project.js';
import { presetConfig } from './vitest/preset.js';
import { unit } from './vitest/unit.project.js';

export { api, type ApiProjectOptions } from './specifications/api/api.project.js';
export {
    cli,
    type CliProjectOptions,
    literate,
    type LiterateDoor,
    type LiterateOptions,
    type LiteratePlugin,
} from './specifications/cli/cli.project.js';
export {
    component,
    type ComponentProjectOptions,
} from './specifications/component/component.project.js';
export {
    deployment,
    type DeploymentProjectOptions,
} from './specifications/deployment/deployment.project.js';
export {
    integration,
    type IntegrationProjectOptions,
} from './specifications/integration/integration.project.js';
export { job, type JobProjectOptions } from './specifications/job/job.project.js';
export { lint, type LintProjectOptions } from './specifications/lint/lint.project.js';
export { mobile, type MobileProjectOptions } from './specifications/mobile/mobile.project.js';
export { website, type WebsiteProjectOptions } from './specifications/website/website.project.js';
export {
    type InProcessProjectOptions,
    type SpecificationProjectOptions,
} from './vitest/project.js';
export { unit, type UnitProjectOptions } from './vitest/unit.project.js';

type Project = Promise<TestProjectInlineConfiguration> | TestProjectInlineConfiguration;

type Builder = (options: Readonly<Record<string, unknown>>) => Project;

// invariant: the specifications a project is keyed by, in the order the config lists the projects; the order they run in is `projectTest`'s.
const BUILDERS: ReadonlyMap<string, Builder> = new Map<string, Builder>([
    ['unit', unit],
    ['lint', lint],
    ['cli', cli],
    ['api', api],
    ['job', job],
    ['integration', integration],
    ['website', website],
    ['deployment', deployment],
    ['mobile', mobile],
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `projectOf` hands every component the root it reads its paths against
    ['component', component as Builder],
]);

const anchored = (root: string, path: string): string =>
    isAbsolute(path) ? path : resolve(root, path);

const anchoredTarget = (root: string, target: unknown): unknown =>
    typeof target === 'string' && target.startsWith('.') ? anchored(root, target) : target;

// invariant: both of vite's forms: a record of names, and a list of `{ find, replacement }`, which alone orders a subpath before its package.
function aliasesFrom(root: string, vite: unknown): unknown {
    if (!isRecord(vite) || !isRecord(vite.resolve)) {
        return vite;
    }
    const stated = vite.resolve.alias;
    if (Array.isArray(stated)) {
        const alias = stated.map((entry: unknown) =>
            isRecord(entry)
                ? { ...entry, replacement: anchoredTarget(root, entry.replacement) }
                : entry,
        );
        return { ...vite, resolve: { ...vite.resolve, alias } };
    }
    if (!isRecord(stated)) {
        return vite;
    }
    const alias = Object.fromEntries(
        Object.entries(stated).map(([name, target]) => [name, anchoredTarget(root, target)]),
    );

    return { ...vite, resolve: { ...vite.resolve, alias } };
}

function refused(found: string, fix: string): Error {
    return new Error(
        refusal({
            fix,
            found,
            read: 'docs/start/set-up-a-project.md#the-vitest-config',
            why: 'a project is derived from the tree, and a declared one only states how it departs from that, with its reason',
        }),
    );
}

// invariant: a declared project is the exception to its derived one: keyed by a specification the package ships, and stating why.
function declaredProjects(declared: unknown): Map<string, Record<string, unknown>> {
    if (declared === undefined) {
        return new Map();
    }
    if (!isRecord(declared)) {
        throw refused(
            '`test.projects` is not a record',
            'key each project by its specification: `projects: { cli: { timeout: 120_000, reason: ... } }`',
        );
    }
    const projects = new Map<string, Record<string, unknown>>();
    for (const [specification, project] of Object.entries(declared)) {
        if (!BUILDERS.has(specification)) {
            throw refused(
                `\`test.projects\` names the specification \`${specification}\``,
                `key it by one of ${[...BUILDERS.keys()].join(', ')}`,
            );
        }
        const { reason, ...options } = isRecord(project) ? project : {};
        if (typeof reason !== 'string' || reason.trim() === '') {
            throw refused(
                `\`test.projects.${specification}\` departs from its derived project with no reason`,
                `state why under \`test.projects.${specification}.reason\`, or delete what the tree already derives`,
            );
        }
        projects.set(specification, options);
    }

    return projects;
}

async function projectOf(
    root: string,
    specification: string,
    { setup, ...options }: Readonly<Record<string, unknown>>,
): Promise<TestProjectInlineConfiguration> {
    const builder = BUILDERS.get(specification);
    // Stryker disable next-line ConditionalExpression: every specification reaching here is a key of the builders
    if (builder === undefined) {
        return {};
    }
    // Stryker disable next-line StringLiteral: the project root is a component's default root, spelled '.' or ''
    const componentRoot = anchored(root, typeof options.root === 'string' ? options.root : '.');
    const project = await builder({
        ...options,
        // Stryker disable next-line ConditionalExpression: only a component reads its root as a path from here
        ...(specification === 'component' ? { root: componentRoot } : {}),
        vite: aliasesFrom(root, options.vite),
    });
    const setups = Array.isArray(setup) ? setup.filter((path) => typeof path === 'string') : [];

    return mergeConfig(
        { test: { globalSetup: setups.map((path) => anchored(root, path)) } },
        project,
    );
}

async function derivedFrom(root: string): Promise<ViteUserConfig> {
    const { problem, resolved } = await readSettings(root);
    if (problem !== null) {
        throw new Error(
            refusal({
                fix: 'correct jterrazz.config.ts as the finding says, then run vitest again',
                found: `jterrazz.config.ts ${problem}`,
                read: 'docs/start/set-up-a-project.md#the-vitest-config',
                why: 'the test projects are declared there, and a config read without them would run none of them',
            }),
        );
    }
    const section = resolved.sections[TEST_SECTION];
    const declared = declaredProjects(isRecord(section) ? section.projects : undefined);
    const own = resolved.own[TEST_SECTION]?.projects;
    const derived = derivedProjects(root);
    // invariant: the standard states how a project departs by default; only the tree, or the project's own file, makes one exist.
    const specifications = [...BUILDERS.keys()].filter(
        (specification) =>
            derived.has(specification) || (isRecord(own) && own[specification] !== undefined),
    );

    return presetConfig(
        specifications.length === 0
            ? {}
            : {
                  test: {
                      projects: await Promise.all(
                          specifications.map(
                              async (specification) =>
                                  await projectOf(root, specification, {
                                      ...derived.get(specification),
                                      ...declared.get(specification),
                                  }),
                          ),
                      ),
                  },
              },
    );
}

export const vitestConfig = async (configUrl: string): Promise<ViteUserConfig> =>
    await derivedFrom(dirname(fileURLToPath(configUrl)));
