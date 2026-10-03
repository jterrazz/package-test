import { readSettings } from '@jterrazz/typescript/rules';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration, ViteUserConfig } from 'vitest/config';

import { TEST_SECTION } from '../lint/kit/project/test-section.js';
import { refusal } from './chain/refusals/refusal.js';
import {
    api,
    cli,
    component,
    defineSpecConfig,
    integration,
    job,
    lint,
    mobile,
    unit,
    website,
} from './index.vitest.js';

type Project = Promise<TestProjectInlineConfiguration> | TestProjectInlineConfiguration;

type Builder = (options: Readonly<Record<string, unknown>>) => Project;

const BUILDERS: Readonly<Record<string, Builder>> = Object.freeze({
    api,
    cli,
    component,
    integration,
    job,
    lint,
    mobile,
    unit,
    website,
});

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

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
    const builder = typeof facet === 'string' ? BUILDERS[facet] : undefined;
    if (builder === undefined) {
        throw new Error(
            refusal({
                fix: `name one of ${Object.keys(BUILDERS).join(', ')} as its \`facet\``,
                found: `a project of \`test.projects\` names the facet \`${String(facet)}\``,
                read: 'docs/06-setting-up.md#the-vitest-config',
                why: 'a project is built by the helper of its facet, which owns its include, its budget and its seam',
            }),
        );
    }
    const project = await builder({
        ...options,
        ...(facet === 'component'
            ? { root: anchored(root, typeof options.root === 'string' ? options.root : '.') }
            : {}),
        ...(options.vite === undefined ? {} : { vite: aliasesFrom(root, options.vite) }),
    });
    const setups = Array.isArray(setup) ? setup.filter((path) => typeof path === 'string') : [];

    return setups.length === 0
        ? project
        : mergeConfig(
              { test: { globalSetup: setups.map((path) => anchored(root, path)) } },
              project,
          );
}

async function derivedFrom(root: string): Promise<ViteUserConfig> {
    const { resolved } = await readSettings(root);
    const section = resolved.sections[TEST_SECTION];
    const projects = isRecord(section) && Array.isArray(section.projects) ? section.projects : [];

    return defineSpecConfig(
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

// A promise rather than a top-level await: knip requires the config, and Node cannot require a module that awaits at its top.
export const vitestConfig = async (configUrl: string): Promise<ViteUserConfig> =>
    await derivedFrom(dirname(fileURLToPath(configUrl)));
