import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';

import { vitestConfig } from './index.vitest.js';

function projectDeclaring(projects: string): string {
    const root = mkdtempSync(join(tmpdir(), 'derived-vitest-'));
    writeFileSync(join(root, 'package.json'), '{ "name": "derived", "type": "module" }\n');
    writeFileSync(
        join(root, 'jterrazz.config.ts'),
        `export default { kind: 'library', platform: 'node', test: { projects: ${projects} } };\n`,
    );

    return root;
}

const configIn = (root: string): string => pathToFileURL(join(root, 'vitest.config.ts')).href;

const refusal = (facet: string): string =>
    [
        `found: a project of \`test.projects\` names the facet \`${facet}\``,
        'why: a project is built by the helper of its facet, which owns its include, its budget and its seam',
        'fix: name one of api, cli, component, integration, job, lint, mobile, unit, website as its `facet`',
        'read: docs/start/set-up-a-project.md#the-vitest-config',
    ].join('\n');

describe('index.vitest', () => {
    test('vitestConfig — builds each declared project with the helper of its facet, its setups read from the project root', async () => {
        // Given - a project declaring a unit project and a cli project with a global setup of its own
        const root = projectDeclaring(
            "[{ facet: 'unit', include: ['src/**/*.test.ts'] }, { facet: 'cli', setup: ['specs/cli/_setup/start.ts'] }]",
        );

        // When - the config is derived for it
        const config = await vitestConfig(configIn(root));
        const projects = (config.test?.projects ?? []).flatMap((project) =>
            typeof project === 'object' && 'test' in project ? [project.test] : [],
        );

        // Then - one project per declaration, named for its facet, the setup anchored at the project root
        expect(projects.map((project) => project?.name)).toStrictEqual(['unit', 'cli']);
        expect(projects[0]?.include).toStrictEqual(['src/**/*.test.ts']);
        expect(projects[1]?.globalSetup).toContain(join(root, 'specs/cli/_setup/start.ts'));
    });

    test('vitestConfig — is the preset alone for a project that declares no test project', async () => {
        // Given - a project with an empty list of projects, and one whose projects are no list
        const configs = await Promise.all(
            ['[]', "'unit'"].map(
                async (projects) => await vitestConfig(configIn(projectDeclaring(projects))),
            ),
        );

        // Then - no project is built, and the preset's budgets stand
        expect(
            configs.map((config) => [config.test?.projects, config.test?.testTimeout]),
        ).toStrictEqual([
            [undefined, 30_000],
            [undefined, 30_000],
        ]);
    });

    test('vitestConfig — refuses a facet the package ships no helper for, and a project naming none, naming the ones it does', async () => {
        // Given - a project naming a facet that does not exist
        const root = projectDeclaring("[{ facet: 'browser' }]");

        const bare = projectDeclaring("['unit']");

        // Then - the refusal names the facet, or that none was named, and the helpers
        await expect(vitestConfig(configIn(root))).rejects.toThrow(new Error(refusal('browser')));
        await expect(vitestConfig(configIn(bare))).rejects.toThrow(new Error(refusal('undefined')));
    });

    test('vitestConfig — refuses a settings file that does not load, rather than running no project', async () => {
        // Given - a project whose jterrazz.config.ts throws as it loads
        const root = mkdtempSync(join(tmpdir(), 'derived-vitest-'));
        writeFileSync(join(root, 'package.json'), '{ "name": "derived", "type": "module" }\n');
        writeFileSync(join(root, 'jterrazz.config.ts'), "throw new Error('presets not built');\n");

        // Then - the refusal names the file and what went wrong
        await expect(vitestConfig(configIn(root))).rejects.toThrow(
            new Error(
                [
                    'found: jterrazz.config.ts does not load — presets not built',
                    'why: the test projects are declared there, and a config read without them would run none of them',
                    'fix: correct jterrazz.config.ts as the finding says, then run vitest again',
                    'read: docs/start/set-up-a-project.md#the-vitest-config',
                ].join('\n'),
            ),
        );
    });

    test('vitestConfig — a component project resolves its root and its aliases from the project, and a setup is read as a path alone', async () => {
        // Given - a component project with aliases of each kind, one rooted in a folder of its own with its vite config there, and a setup list holding a stray value
        const root = projectDeclaring(
            "[{ facet: 'component', vite: { resolve: { alias: { '@': './src', abs: '/abs', obj: { x: 1 }, pkg: 'some-package' } } } }, { facet: 'component', root: 'app', vite: './vite.config.ts', setup: ['start.ts', 3] }, { facet: 'component', vite: { define: { A: '1' } } }]",
        );
        mkdirSync(join(root, 'app'));
        writeFileSync(
            join(root, 'app/vite.config.ts'),
            "export default { resolve: { alias: { '#': '/hash' } } };\n",
        );

        // When - the config is derived
        const config = await vitestConfig(configIn(root));
        const projects = (config.test?.projects ?? []).flatMap((project) =>
            typeof project === 'object' && 'test' in project ? [project] : [],
        );

        // Then - the relative alias anchored at the project root, the others as written; the rooted one's own config read; the stray setup dropped; a config with no alias as written
        expect(
            projects.map((project) => [
                project.resolve?.alias,
                [project.test?.globalSetup ?? []].flat().filter((path) => path.startsWith(root)),
                project.define,
            ]),
        ).toStrictEqual([
            [
                { '@': join(root, 'src'), abs: '/abs', obj: { x: 1 }, pkg: 'some-package' },
                [],
                undefined,
            ],
            [{ '#': '/hash' }, [join(root, 'start.ts')], undefined],
            [undefined, [], { A: '1' }],
        ]);
    });
});
