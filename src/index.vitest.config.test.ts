import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { vitestConfig } from './index.vitest.config.js';

function projectDeclaring(projects: string): string {
    const root = mkdtempSync(join(tmpdir(), 'derived-vitest-'));
    writeFileSync(join(root, 'package.json'), '{ "name": "derived", "type": "module" }\n');
    writeFileSync(
        join(root, 'jterrazz.config.ts'),
        `export default { kind: 'library', platform: 'node', test: { projects: ${projects} } };\n`,
    );

    return root;
}

describe('vitestConfig', () => {
    test('builds each declared project with the helper of its facet, its setups read from the project root', async () => {
        // Given - a project declaring a unit project and a cli project with a global setup of its own
        const root = projectDeclaring(
            "[{ facet: 'unit', include: ['src/**/*.test.ts'] }, { facet: 'cli', setup: ['specs/cli/_setup/start.ts'] }]",
        );

        // When - the config is derived for it
        const config = await vitestConfig(root);
        const projects = (config.test?.projects ?? []).flatMap((project) =>
            typeof project === 'object' && 'test' in project ? [project.test] : [],
        );

        // Then - one project per declaration, named for its facet, the setup anchored at the project root
        expect(projects.map((project) => project?.name)).toStrictEqual(['unit', 'cli']);
        expect(projects[0]?.include).toStrictEqual(['src/**/*.test.ts']);
        expect(projects[1]?.globalSetup).toContain(join(root, 'specs/cli/_setup/start.ts'));
    });

    test('is the preset alone for a project that declares no test project', async () => {
        // Given - a project with an empty list of projects
        const root = projectDeclaring('[]');

        // Then - no project is built, and the preset's budgets stand
        const config = await vitestConfig(root);
        expect(config.test?.projects).toBeUndefined();
        expect(config.test?.testTimeout).toBe(30_000);
    });

    test('refuses a facet the package ships no helper for, naming the ones it does', async () => {
        // Given - a project naming a facet that does not exist
        const root = projectDeclaring("[{ facet: 'browser' }]");

        // Then - the refusal names the facet and the helpers
        await expect(vitestConfig(root)).rejects.toThrow(
            'found: a project of `test.projects` names the facet `browser`',
        );
    });
});
