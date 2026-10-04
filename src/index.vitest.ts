import { readSettings } from '@jterrazz/typescript/rules';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration, ViteUserConfig } from 'vitest/config';

import { isRecord } from '../lint/kit/project/json-shape.js';
import { TEST_SECTION } from '../lint/kit/project/test-section.js';
import { refusal } from './chain/refusals/refusal.js';
import { api } from './facets/api/api.project.js';
import { cli, literate } from './facets/cli/cli.project.js';
import type { LiterateOptions } from './facets/cli/cli.project.js';
import { component } from './facets/component/component.project.js';
import { integration } from './facets/integration/integration.project.js';
import { job } from './facets/job/job.project.js';
import { lint } from './facets/lint/lint.project.js';
import { mobile } from './facets/mobile/mobile.project.js';
import { website } from './facets/website/website.project.js';
import { presetConfig } from './vitest/preset.js';
import { unit } from './vitest/unit.project.js';

export { api, type ApiProjectOptions } from './facets/api/api.project.js';
export {
    cli,
    type CliProjectOptions,
    literate,
    type LiterateDoor,
    type LiterateOptions,
    type LiteratePlugin,
} from './facets/cli/cli.project.js';
export { component, type ComponentProjectOptions } from './facets/component/component.project.js';
export {
    integration,
    type IntegrationProjectOptions,
} from './facets/integration/integration.project.js';
export { job, type JobProjectOptions } from './facets/job/job.project.js';
export { lint, type LintProjectOptions } from './facets/lint/lint.project.js';
export { mobile, type MobileProjectOptions } from './facets/mobile/mobile.project.js';
export { website, type WebsiteProjectOptions } from './facets/website/website.project.js';
export { type FacetProjectOptions, type InProcessProjectOptions } from './vitest/project.js';
export { unit, type UnitProjectOptions } from './vitest/unit.project.js';

/** A vite/vitest config, merged over the preset's defaults, plus `literate`. */
export type SpecConfig = ViteUserConfig & {
    /** Turns matching `<case>.spec.yaml` files into tests; with `projects`, put the plugin in the collecting project instead. */
    literate?: LiterateOptions;
};

/** The shared vitest config: what you pass is merged over the defaults. */
export function defineSpecConfig(config: SpecConfig = {}): ViteUserConfig {
    const { literate: literateOptions, ...userConfig } = config;
    return presetConfig(
        literateOptions
            ? (mergeConfig({ plugins: [literate(literateOptions)] }, userConfig) as ViteUserConfig)
            : userConfig,
    );
}

type Project = Promise<TestProjectInlineConfiguration> | TestProjectInlineConfiguration;

type Builder = (options: Readonly<Record<string, unknown>>) => Project;

const BUILDERS: ReadonlyMap<string, Builder> = new Map<string, Builder>([
    ['api', api],
    ['cli', cli],
    ['component', component],
    ['integration', integration],
    ['job', job],
    ['lint', lint],
    ['mobile', mobile],
    ['unit', unit],
    ['website', website],
]);

const anchored = (root: string, path: string): string =>
    isAbsolute(path) ? path : resolve(root, path);

function aliasesFrom(root: string, vite: unknown): unknown {
    if (!isRecord(vite) || !isRecord(vite.resolve) || !isRecord(vite.resolve.alias)) {
        return vite;
    }
    const alias = Object.fromEntries(
        Object.entries(vite.resolve.alias).map(([name, target]) => [
            name,
            typeof target === 'string' && target.startsWith('.') ? anchored(root, target) : target,
        ]),
    );

    return { ...vite, resolve: { ...vite.resolve, alias } };
}

async function projectOf(root: string, declared: unknown): Promise<TestProjectInlineConfiguration> {
    const { facet, setup, ...options } = isRecord(declared) ? declared : {};
    const builder = BUILDERS.get(String(facet));
    if (builder === undefined) {
        throw new Error(
            refusal({
                fix: `name one of ${[...BUILDERS.keys()].join(', ')} as its \`facet\``,
                found: `a project of \`test.projects\` names the facet \`${String(facet)}\``,
                read: 'docs/start/set-up-a-project.md#the-vitest-config',
                why: 'a project is built by the helper of its facet, which owns its include, its budget and its seam',
            }),
        );
    }
    // Stryker disable next-line StringLiteral: the project root is a component's default root, spelled '.' or ''
    const componentRoot = anchored(root, typeof options.root === 'string' ? options.root : '.');
    const project = await builder({
        ...options,
        // Stryker disable next-line ConditionalExpression: only a component reads its root as a path from here
        ...(facet === 'component' ? { root: componentRoot } : {}),
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
    const projects = isRecord(section) && Array.isArray(section.projects) ? section.projects : [];

    return presetConfig(
        projects.length === 0
            ? {}
            : {
                  test: {
                      projects: await Promise.all(
                          projects.map(async (declared) => await projectOf(root, declared)),
                      ),
                  },
              },
    );
}

export const vitestConfig = async (configUrl: string): Promise<ViteUserConfig> =>
    await derivedFrom(dirname(fileURLToPath(configUrl)));
