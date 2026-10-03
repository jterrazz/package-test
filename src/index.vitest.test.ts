import { mkdtempSync, writeFileSync } from 'node:fs';
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
        // Given - a project with an empty list of projects
        const root = projectDeclaring('[]');

        // Then - no project is built, and the preset's budgets stand
        const config = await vitestConfig(configIn(root));
        expect(config.test?.projects).toBeUndefined();
        expect(config.test?.testTimeout).toBe(30_000);
    });

    test('vitestConfig — refuses a facet the package ships no helper for, naming the ones it does', async () => {
        // Given - a project naming a facet that does not exist
        const root = projectDeclaring("[{ facet: 'browser' }]");

        // Then - the refusal names the facet and the helpers
        await expect(vitestConfig(configIn(root))).rejects.toThrow(
            'found: a project of `test.projects` names the facet `browser`',
        );
    });

    test('vitestConfig — refuses a settings file that does not load, rather than running no project', async () => {
        // Given - a project whose jterrazz.config.ts throws as it loads
        const root = mkdtempSync(join(tmpdir(), 'derived-vitest-'));
        writeFileSync(join(root, 'package.json'), '{ "name": "derived", "type": "module" }\n');
        writeFileSync(join(root, 'jterrazz.config.ts'), "throw new Error('presets not built');\n");

        // Then - the refusal names the file and what went wrong
        await expect(vitestConfig(configIn(root))).rejects.toThrow(
            'found: jterrazz.config.ts does not load — presets not built',
        );
    });
});
