import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import type { ViteUserConfig } from 'vitest/config';

import { vitestConfig } from '../index.vitest.js';

function projectDeclaring(projects: string, files: readonly string[] = []): string {
    const root = mkdtempSync(join(tmpdir(), 'derived-vitest-'));
    writeFileSync(join(root, 'package.json'), '{ "name": "derived", "type": "module" }\n');
    writeFileSync(
        join(root, 'studio.config.ts'),
        `export default { kind: 'library', platform: 'node', test: { projects: ${projects} } };\n`,
    );
    for (const file of files) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), '');
    }

    return root;
}

const configIn = (root: string): string => pathToFileURL(join(root, 'vitest.config.ts')).href;

type Built = NonNullable<ViteUserConfig['test']>;

async function projectsOf(root: string): Promise<(ViteUserConfig & { test?: Built })[]> {
    const config = await vitestConfig(configIn(root));

    return (config.test?.projects ?? []).flatMap((project) =>
        typeof project === 'object' && 'test' in project ? [project] : [],
    );
}

const refusal = (found: string, fix: string): string =>
    [
        `found: ${found}`,
        'why: a project is derived from the tree, and a declared one only states how it departs from that, with its reason',
        `fix: ${fix}`,
        'read: docs/start/set-up-a-project.md#the-vitest-config',
    ].join('\n');

describe('index.vitest', () => {
    test('vitestConfig — a declared project states how it departs from the derived one, its setups read from the project root', async () => {
        // Given - a derived cli project with a global setup and a budget of its own, and a website project with no folder
        const root = projectDeclaring(
            "{ cli: { reason: 'the packed tarball', setup: ['specs/cli/__setup__/start.ts'], timeout: 120000 }, website: { reason: 'the pages', include: ['e2e/**/*.spec.ts'] } }",
            ['specs/cli/run.spec.ts', 'specs/component/page.test.tsx', 'specs/job/run.spec.ts'],
        );

        // When - the config is derived for it
        const projects = await projectsOf(root);

        // Then - the declared options over the derived ones, the setup anchored at the root; the job and component specs collected from their folders
        expect(projects.map(({ test: built }) => built?.name)).toStrictEqual([
            'cli',
            'job',
            'website',
            'component',
        ]);
        expect(projects[0]?.test?.globalSetup).toContain(
            join(root, 'specs/cli/__setup__/start.ts'),
        );
        expect(projects[0]?.test?.testTimeout).toBe(120_000);
        expect(projects[2]?.test?.include).toStrictEqual(['e2e/**/*.spec.ts']);
        expect(projects[3]?.test?.include).toStrictEqual(['specs/component/**/*.test.tsx']);
    });

    test('vitestConfig — is the preset alone for a tree with no test and no declared project', async () => {
        // Given - a project holding no test, its test section declaring no project
        const config = await vitestConfig(
            configIn(projectDeclaring('undefined', ['src/index.ts'])),
        );

        // Then - no project is built, and the preset's budgets stand
        expect([config.test?.projects, config.test?.testTimeout]).toStrictEqual([
            undefined,
            30_000,
        ]);
    });

    test('vitestConfig — a preset shapes the projects the tree derives, and makes none exist', async () => {
        // Given - a preset stating how the unit and lint projects depart by default, over a tree holding module tests and the cli specs alone
        const root = mkdtempSync(join(tmpdir(), 'derived-vitest-'));
        writeFileSync(join(root, 'package.json'), '{ "name": "derived", "type": "module" }\n');
        writeFileSync(
            join(root, 'studio.config.ts'),
            "export default { kind: 'library', platform: 'node', presets: [{ name: 'test', package: '@acme/test', settings: { projects: { lint: { reason: 'r', timeout: 5000 }, unit: { isolate: false, reason: 'r' } } } }] };\n",
        );
        for (const file of ['src/orders.test.ts', 'specs/cli/run.spec.ts']) {
            mkdirSync(dirname(join(root, file)), { recursive: true });
            writeFileSync(join(root, file), '');
        }

        // When - the config is derived for it
        const projects = await projectsOf(root);

        // Then - the unit project shared one module graph, and no lint project is built
        expect(projects.map(({ test: built }) => [built?.name, built?.isolate])).toStrictEqual([
            ['unit', false],
            ['cli', undefined],
        ]);
    });

    test('vitestConfig — refuses projects written as a list, keyed by no specification it ships, or departing with no reason', async () => {
        // Given - the ways a declared project is no exception to a derived one, a blank reason among them
        const listed = projectDeclaring("[{ specification: 'unit' }]");
        const unknown = projectDeclaring("{ browser: { reason: 'the pages' } }");
        const unreasoned = projectDeclaring('{ unit: { isolate: false } }');
        const blank = projectDeclaring("{ unit: { isolate: false, reason: '  ' } }");

        // Then - each refusal names what it found, and how to state it
        await expect(vitestConfig(configIn(listed))).rejects.toThrow(
            new Error(
                refusal(
                    '`test.projects` is not a record',
                    'key each project by its specification: `projects: { cli: { timeout: 120_000, reason: ... } }`',
                ),
            ),
        );
        await expect(vitestConfig(configIn(unknown))).rejects.toThrow(
            new Error(
                refusal(
                    '`test.projects` names the specification `browser`',
                    'key it by one of unit, lint, cli, api, job, integration, website, mobile, component',
                ),
            ),
        );
        await expect(vitestConfig(configIn(unreasoned))).rejects.toThrow(
            new Error(
                refusal(
                    '`test.projects.unit` departs from its derived project with no reason',
                    'state why under `test.projects.unit.reason`, or delete what the tree already derives',
                ),
            ),
        );
        await expect(vitestConfig(configIn(blank))).rejects.toThrow(
            new Error(
                refusal(
                    '`test.projects.unit` departs from its derived project with no reason',
                    'state why under `test.projects.unit.reason`, or delete what the tree already derives',
                ),
            ),
        );
    });

    test('vitestConfig — refuses a settings file that does not load, rather than running no project', async () => {
        // Given - a project whose studio.config.ts throws as it loads
        const root = mkdtempSync(join(tmpdir(), 'derived-vitest-'));
        writeFileSync(join(root, 'package.json'), '{ "name": "derived", "type": "module" }\n');
        writeFileSync(join(root, 'studio.config.ts'), "throw new Error('presets not built');\n");

        // Then - the refusal names the file and what went wrong
        await expect(vitestConfig(configIn(root))).rejects.toThrow(
            new Error(
                [
                    'found: studio.config.ts does not load: presets not built',
                    'why: the test projects are declared there, and a config read without them would run none of them',
                    'fix: correct studio.config.ts as the finding says, then run vitest again',
                    'read: docs/start/set-up-a-project.md#the-vitest-config',
                ].join('\n'),
            ),
        );
    });

    test('vitestConfig — a component project resolves its root and its aliases from the project, and a setup is read as a path alone', async () => {
        // Given - a component project with aliases of each kind and a setup list holding a stray value, one rooted in a folder of its own with its vite config there, one with no alias, and one listing its aliases in order
        const aliased = projectDeclaring(
            "{ component: { reason: 'the app', setup: ['start.ts', 3], vite: { resolve: { alias: { '@': './src', abs: '/abs', obj: { x: 1 }, pkg: 'some-package' } } } } }",
        );
        const rooted = projectDeclaring(
            "{ component: { reason: 'the app', root: 'app', vite: './vite.config.ts' } }",
        );
        mkdirSync(join(rooted, 'app'));
        writeFileSync(
            join(rooted, 'app/vite.config.ts'),
            "export default { resolve: { alias: { '#': '/hash' } } };\n",
        );
        const plain = projectDeclaring(
            "{ component: { reason: 'the app', vite: { define: { A: '1' }, resolve: { conditions: ['app'] } } } }",
        );
        const listed = projectDeclaring(
            "{ component: { reason: 'the app', vite: { resolve: { alias: [{ find: 'app/sub', replacement: './sub.js' }, { find: 'app', replacement: 'some-package' }, 3] } } } }",
        );

        // When - the configs are derived
        const projects = await Promise.all(
            [aliased, rooted, plain, listed].map(async (root) => {
                const [project] = await projectsOf(root);

                return project;
            }),
        );

        // Then - the relative alias anchored at the project root, in a record as in a list, the others as written; the rooted one's own config read; the stray setup dropped; a config with no alias as written
        expect(
            projects.map((project, index) => [
                project?.resolve?.alias,
                [project?.test?.globalSetup ?? []]
                    .flat()
                    .filter((path) =>
                        path.startsWith([aliased, rooted, plain, listed][index] ?? ''),
                    ),
                project?.define,
            ]),
        ).toStrictEqual([
            [
                { '@': join(aliased, 'src'), abs: '/abs', obj: { x: 1 }, pkg: 'some-package' },
                [join(aliased, 'start.ts')],
                undefined,
            ],
            [{ '#': '/hash' }, [], undefined],
            [undefined, [], { A: '1' }],
            [
                [
                    { find: 'app/sub', replacement: join(listed, 'sub.js') },
                    { find: 'app', replacement: 'some-package' },
                    3,
                ],
                [],
                undefined,
            ],
        ]);
    });
});
