import { CAPACITY_VARIABLE } from '@jterrazz/typescript/rules';
import { isAbsolute, relative } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import {
    ATTACHMENTS_DIR,
    COVERAGE_DIR,
    NODE_COMPILE_CACHE_DIR,
    REPORTER_OUTPUT_FILES,
    VITEST_ARTIFACTS_DIR,
} from '../../../lint/kit/project/artifacts.js';
import { presetConfig, reporterOutputFiles } from '../preset.js';
import { unit } from '../unit.project.js';

function excludeOf(config: ReturnType<typeof presetConfig>): string[] {
    const [project] = config.test?.projects ?? [];
    if (typeof project !== 'object' || project === null || !('test' in project)) {
        return [];
    }
    return project.test?.exclude ?? [];
}
describe('preset', () => {
    test('presetConfig() — artefact paths — sends the vite cache and the coverage report under .artifacts/vitest', () => {
        // Given - the preset alone, nothing stated
        const config = presetConfig();

        // Then - both writers point inside the one artefact folder, and the coverage block names the machine-readable report beside text and html (`json-summary`)
        expect(config.cacheDir).toBe(VITEST_ARTIFACTS_DIR);
        expect(config.test?.coverage).toMatchObject({
            provider: 'v8',
            reporter: ['text', 'html', 'json-summary'],
            reportsDirectory: COVERAGE_DIR,
        });
    });

    test('presetConfig() — artefact paths — routes every path Vitest 5 pins under .artifacts/vitest', () => {
        // Given - the preset alone: the attachments a test annotates, the failure screenshots, and the four reporters that became file writers
        const config = presetConfig();

        // Then - none of them lands on `.vitest/` at the repository root, which is the one folder the estate's artefact rule does not cover
        expect(config.test?.attachmentsDir).toBe(ATTACHMENTS_DIR);
        expect(config.test?.outputFile).toStrictEqual(REPORTER_OUTPUT_FILES);
        expect(
            Object.values(REPORTER_OUTPUT_FILES).every((path) =>
                path.startsWith(VITEST_ARTIFACTS_DIR),
            ),
        ).toBe(true);
    });

    test('presetConfig() — artefact paths — names the blob of a shard for its shard, so the shards of one run land side by side', () => {
        // Given - the arguments of a whole run, and of two shards spelled both ways
        const whole = reporterOutputFiles(['node', 'vitest', 'run']);
        const first = reporterOutputFiles(['node', 'vitest', 'run', '--shard=1/3']);
        const second = reporterOutputFiles(['node', 'vitest', 'run', '--shard', '2/3']);

        // Then - one blob per shard in the one blob folder, and the run's own when there is none
        expect(whole.blob).toBe(`${VITEST_ARTIFACTS_DIR}/blob/blob.json`);
        expect([first.blob, second.blob]).toStrictEqual([
            `${VITEST_ARTIFACTS_DIR}/blob/blob-1-3.json`,
            `${VITEST_ARTIFACTS_DIR}/blob/blob-2-3.json`,
        ]);
    });

    test("presetConfig() — artefact paths — points node's compile cache under .artifacts by an absolute path, which a process spawned in its own folder reads alike", () => {
        // Given - the preset alone, nothing stated
        const cache = presetConfig().test?.env?.NODE_COMPILE_CACHE ?? '';

        // Then - the run's env names the one cache folder of the project
        expect(isAbsolute(cache)).toBe(true);
        expect(relative(process.cwd(), cache)).toBe(NODE_COMPILE_CACHE_DIR);
    });

    test("presetConfig() — workers — runs as many as the toolchain's capacity model gives the vitest pool, inside a gate's slice too", () => {
        // Given - a run inside a gate whose slice is three cpus and ample memory, then one handed a capacity no gate could read
        vi.stubEnv(CAPACITY_VARIABLE, 'cpus=3,memory=64g');
        const sliced = presetConfig().test?.maxWorkers;
        vi.stubEnv(CAPACITY_VARIABLE, 'three cpus');

        // Then - three workers, the cpus binding, and the unreadable capacity refused before any worker starts
        expect(sliced).toBe(3);
        expect(() => presetConfig()).toThrow(CAPACITY_VARIABLE);
    });

    test("presetConfig() — workers — states the run's one read on every inline project, which vitest may resolve by evaluating the config again", () => {
        // Given - a run handed three cpus, of a project stating no count and one stating its own
        vi.stubEnv(CAPACITY_VARIABLE, 'cpus=3,memory=64g');
        const config = presetConfig({
            test: {
                projects: [
                    { test: { include: ['src/a.test.ts'], name: 'unit' } },
                    { test: { include: ['specs/b.spec.ts'], maxWorkers: 1, name: 'alone' } },
                ],
            },
        });

        // Then - the first carries the count the run read, the second keeps its own
        expect(
            (config.test?.projects ?? []).map((project) =>
                typeof project === 'object' && 'test' in project
                    ? project.test?.maxWorkers
                    : undefined,
            ),
        ).toStrictEqual([3, 1]);
    });

    test('presetConfig() — artefact paths — gives a project the attachments directory too', () => {
        // Given - a config with one inline project
        const config = presetConfig({
            test: { projects: [{ test: { include: ['src/a.test.ts'], name: 'unit' } }] },
        });

        // Then - the project carries it on its own: a project inherits nothing from the root
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({ test: { attachmentsDir: ATTACHMENTS_DIR } });
    });

    test('presetConfig() — artefact paths — gives every inline project the cache dir too', () => {
        // Given - a config with projects (each is resolved as its own vite config, inheriting nothing from the root)
        const config = presetConfig({
            test: { projects: [{ test: { include: ['src/a.test.ts'], name: 'unit' } }] },
        });

        // Then - the project carries the artefact cache dir on its own
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({ cacheDir: VITEST_ARTIFACTS_DIR });
    });

    test('presetConfig() — defaults — raises the test and hook budgets to 30s', () => {
        // Given - the preset alone
        const config = presetConfig();

        // Then - vitest's 5s/10s defaults are replaced by the ecosystem's
        expect(config.test?.testTimeout).toBe(30_000);
        expect(config.test?.hookTimeout).toBe(30_000);
    });

    test('presetConfig() — defaults — carries the same budgets and exclusions into a project', () => {
        // Given - a project that states only its own include
        const config = presetConfig({
            test: { projects: [{ test: { include: ['src/a.test.ts'], name: 'unit' } }] },
        });

        // Then - the project got the defaults, not vitest's
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({
            test: { hookTimeout: 30_000, testTimeout: 30_000 },
        });
        const exclude =
            typeof project === 'object' && 'test' in project ? project.test?.exclude : undefined;
        expect(exclude).toContain('**/{__expected__,__fixtures__,__requests__,__seeds__}/**');
    });

    test('presetConfig() — what the consumer states wins — a stated timeout replaces the default instead of adding to it', () => {
        // Given - a config raising the budget for a slow simulator suite
        const config = presetConfig({ test: { testTimeout: 240_000 } });

        // Then - the stated value is the one vitest sees
        expect(config.test?.testTimeout).toBe(240_000);
    });

    test('presetConfig() — what the consumer states wins — a stated exclude ADDS to the preset list rather than replacing it', () => {
        // Given - a config excluding one heavy spec
        const config = presetConfig({ test: { exclude: ['specs/smoke/**'] } });

        // Then - vite concatenates: the preset's exclusions survive, so a consumer never has to spread `configDefaults.exclude` by hand
        expect(config.test?.exclude).toContain('specs/smoke/**');
        expect(config.test?.exclude).toContain(
            '**/{__expected__,__fixtures__,__requests__,__seeds__}/**',
        );
    });

    test('presetConfig() — what the consumer states wins — a project overrides the preset per project', () => {
        // Given - one sequential project among defaults
        const config = presetConfig({
            test: {
                projects: [
                    { test: { fileParallelism: false, name: 'integrations', testTimeout: 60_000 } },
                ],
            },
        });

        // Then - its own values win, and the rest of the preset stays
        const [project] = config.test?.projects ?? [];
        expect(project).toMatchObject({
            cacheDir: VITEST_ARTIFACTS_DIR,
            test: { fileParallelism: false, hookTimeout: 30_000, testTimeout: 60_000 },
        });
    });

    test('presetConfig() — what the consumer states wins — a project declared as a glob string is handed back untouched', () => {
        // Given - vitest's other project form: a path glob
        const config = presetConfig({ test: { projects: ['packages/*'] } });

        // Then - there is no object to merge into, so nothing is invented
        expect(config.test?.projects).toStrictEqual(['packages/*']);
    });

    test('presetConfig() — every glob stated once — a helper built on the defaults does not carry them twice', () => {
        // Given - the canonical config: one helper project, which is built ON the defaults and then merged INTO them
        const config = presetConfig({ test: { projects: [unit()] } });

        // Then - vite concatenates the two lists, and the result names each glob once
        expect(excludeOf(config)).toStrictEqual([
            '**/node_modules/**',
            '**/.git/**',
            '.artifacts/**',
            '**/{__expected__,__fixtures__,__requests__,__seeds__}/**',
            'specs/**',
            '**/*.test.tsx',
        ]);
    });

    test('presetConfig() — every glob stated once — the root drops the exclusions every project already states', () => {
        // Given - the same config: with projects, the root collects nothing and its list only travels into them, where vitest concatenates it
        const config = presetConfig({ test: { projects: [unit()] } });

        // Then - nothing of the preset's is left to travel, so the banner prints one copy
        expect(config.test?.exclude).toStrictEqual([]);
    });

    test('presetConfig() — every glob stated once — what the consumer states at the root still reaches the projects', () => {
        // Given - a root exclusion no project holds a copy of
        const config = presetConfig({ test: { exclude: ['heavy/**'], projects: [unit()] } });

        // Then - it stays where vitest will read it
        expect(config.test?.exclude).toStrictEqual(['heavy/**']);
    });

    test('presetConfig() — every glob stated once — a project named by a glob or a promise keeps the root exclusions it depends on, beside an inline one', () => {
        // Given - projects this preset never merged into, each beside one it did: their config is another file's
        const awaited = Promise.resolve({ test: { name: 'later' } });
        const globbed = presetConfig({ test: { projects: [unit(), 'packages/*'] } });
        const promised = presetConfig({ test: { projects: [unit(), awaited] } });

        // Then - the root is the only place their exclusions can come from, so nothing is dropped, and the promise is handed back as it was
        expect([
            globbed.test?.exclude?.includes(
                '**/{__expected__,__fixtures__,__requests__,__seeds__}/**',
            ),
            promised.test?.exclude?.includes(
                '**/{__expected__,__fixtures__,__requests__,__seeds__}/**',
            ),
            promised.test?.projects?.[1] === awaited,
        ]).toStrictEqual([true, true, true]);
    });

    test('presetConfig() — the hygiene a suite does not have to write — what a config states wins over all of it', () => {
        // Given - a repository whose subject IS the retry
        const config = presetConfig({ test: { retry: 2 } });

        // Then - the preset is a default, not a ceiling
        expect(config.test?.retry).toBe(2);
    });
});
