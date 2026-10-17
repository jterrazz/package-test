import type { ArchitectureRule, NamesRule, Preset } from '@jterrazz/typescript/config';
import {
    declaredSubpaths,
    readAt,
    RENAMED_FOLDERS,
    rowNamed,
    SETUP_FOLDER,
    SPECIAL_FOLDERS,
    whyOf,
} from '@jterrazz/typescript/rules';
import { createRequire } from 'node:module';
import { posix } from 'node:path';

import STANDARD from '../../../src/standard/standard.js';
import { CATALOGUE_CHAPTER } from '../../kit/catalogue/chapter.js';
import { derivedProjects, specificationModules } from '../../kit/project/derived-projects.js';
import { isRecord } from '../../kit/project/json-shape.js';
import { packagesLoadedFor } from '../../kit/project/loaded-packages.js';
import { TEST_SECTION } from '../../kit/project/test-section.js';
import { consumerRows, recommendedRules } from '../catalogue/manifest.js';
import { importRulesForSpecifications } from './import.js';
import { vitestOnTests } from './vitest.js';

type Lesson = Pick<ArchitectureRule, 'read' | 'why'>;

function taughtBy(name: string): Lesson {
    const row = rowNamed(consumerRows, name);

    return { read: readAt(row, CATALOGUE_CHAPTER), why: whyOf(row) };
}

const escaped = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const either = (patterns: readonly string[]): string =>
    `(?:${patterns.map((pattern) => `(${pattern})`).join('|')})`;

const SOURCE = String.raw`\.[cm]?[jt]sx?$`;

const TEST_FILE = String.raw`\.(test\.[cm]?[jt]sx?|spec\.[cm]?[jt]s)$`;

const RUNS_A_TEST = String.raw`\.(test\.tsx?|spec\.ts|specification\.tsx?)$`;

function packages(names: readonly string[]): string {
    return either(
        names.map((name) => {
            const written = name.endsWith('*')
                ? `${escaped(name.slice(0, -1))}[^/]*`
                : escaped(name);

            return String.raw`(^|/)node_modules/${written}([./]|$)|^${written}([./]|$)`;
        }),
    );
}

type Seam = { fix: string; from?: string; packages: readonly string[]; seam: string };

const SEAMS: readonly Seam[] = [
    {
        fix: '`component.render()` and the element vocabulary render in a real browser: the queries are the same nouns, and they run against what ships',
        packages: ['@testing-library/*'],
        seam: 'renderer',
    },
    {
        fix: "a drawing of a browser proves what a browser does not: a rendered thing is a `.test.tsx` in the `__tests__/` of its component's folder, collected by `component()`",
        packages: ['happy-dom', 'jsdom'],
        seam: 'simulated-dom',
    },
    {
        fix: 'Browser Mode is the seam, not the surface: `component.render()` owns the locators, the visitor and the ARIA tree',
        packages: ['vitest/browser', 'vitest-browser-*', '@vitest/browser*'],
        seam: 'browser-mode',
    },
    {
        fix: 'the network answers through stubs: `await using _ = await intercept(defineStubs(...))` in module scope, `.intercept()` on a chain',
        packages: ['msw', 'nock'],
        seam: 'network',
    },
    {
        fix: 'the doubles ladder is closed: `mockOf<Port>()` for an injected interface, `vi.fn()` for a function, `vi.spyOn` for an object the test passes in',
        packages: ['sinon', 'vitest-mock-extended'],
        seam: 'doubles',
    },
    {
        fix: 'vitest is the runner this vocabulary speaks: `test`, `expect` and `vi` come from it',
        packages: ['jest', '@jest/*'],
        seam: 'runner',
    },
    {
        fix: 'time is one primitive: `using _ = clock.at(iso)` pins the calendar and gives it back at the end of the scope',
        packages: ['mockdate'],
        seam: 'clock',
    },
    {
        fix: 'the website specification drives the browser: `specification.website()` owns the page, and the peer is its',
        packages: ['playwright', 'playwright-core', '@playwright/test'],
        seam: 'browser',
    },
    {
        fix: 'the mobile specification drives the simulator: `specification.mobile()` owns the session, and the peers are its',
        packages: ['webdriverio', 'appium'],
        seam: 'simulator',
    },
    {
        fix: 'a component rendered to a string is still a component: the test is a `.test.tsx` in the `__tests__/` of its folder, and `result.html` carries the markup',
        from: String.raw`\.test\.ts$`,
        packages: ['react-dom/server'],
        seam: 'string-renderer',
    },
];

const secondRuntime = taughtBy('no-second-test-runtime');

function secondRuntimeLaw(seam: Seam, pathNot?: string): ArchitectureRule {
    return {
        fix: seam.fix,
        from: { path: seam.from ?? RUNS_A_TEST, ...(pathNot === undefined ? {} : { pathNot }) },
        name: `no-second-test-runtime-${seam.seam}`,
        read: secondRuntime.read,
        to: { path: packages(seam.packages) },
        why: secondRuntime.why,
    };
}

/** The preset's law of each seam named, every test file held to it but those `pathNot` names. */
export function presetSeamLawsApartFrom(
    seams: readonly string[],
    pathNot: string,
): ArchitectureRule[] {
    return SEAMS.filter(({ seam }) => seams.includes(seam)).map((seam) =>
        secondRuntimeLaw(seam, pathNot),
    );
}

function publishedFix(): string {
    const published = declaredSubpaths('@jterrazz/test', import.meta.dirname);

    return `import from "@jterrazz/test"; the published subpaths are ${published.length === 0 ? 'none' : published.join(', ')}`;
}

const LAYERS: ArchitectureRule[] = [
    {
        ...taughtBy('no-test-to-test-import'),
        fix: 'under `specs/`, move what both read into the `__setup__/` of the lowest folder they share; under `src/`, into a `__tests__/<file>.fixtures.ts` for typed input data',
        from: { path: TEST_FILE },
        name: 'no-test-to-test-import',
        to: { path: String.raw`\.test\.[cm]?[jt]sx?$` },
    },
    {
        ...taughtBy('fixtures-imported-by-tests-only'),
        fix: 'import it from a `*.test.ts` only, or move what the file needs into a module of its own',
        from: { pathNot: TEST_FILE },
        name: 'fixtures-imported-by-tests-only',
        to: { path: String.raw`\.fixtures${SOURCE}` },
    },
    ...SEAMS.map((seam) => secondRuntimeLaw(seam)),
    {
        ...taughtBy('no-unpublished-subpath'),
        fix: publishedFix(),
        from: {},
        name: 'no-unpublished-subpath',
        to: { couldNotResolve: true, path: '^@jterrazz/test/' },
    },
];

const EXTENSIONS = ['c', 'm', ''].flatMap((module) =>
    ['j', 't'].flatMap((language) => ['x', ''].map((jsx) => `${module}${language}s${jsx}`)),
);

const AT_THE_SPECS_ROOT = [
    ...['test', 'test-d', 'spec', 'specification'].flatMap((kind) =>
        EXTENSIONS.map((extension) => `.${kind}.${extension}`),
    ),
    '.spec.yaml',
];

const ANY_OTHER_FILE = ['.*', '.*.*', '.*.*.*', '.*.*.*.*'];

// invariant: a workspace's own suite is a unit of its own, so its specs root also holds the four files of a unit.
const OF_A_UNIT: readonly [string, string][] = [
    ['.json', 'regex:(package|tsconfig)'],
    ['.config.ts', 'regex:(jterrazz|vitest)'],
];

function specsRootFiles(): Record<string, string> {
    const refused = ANY_OTHER_FILE.map((key): [string, string] => [key, 'exists:0']);
    const held = AT_THE_SPECS_ROOT.flatMap((key): [string, string][] => [
        [key, 'regex:.+'],
        [`.*${key}`, 'regex:.+'],
    ]);

    return Object.fromEntries([...refused, ...held, ...OF_A_UNIT]);
}

const CLOSED_LIST = `regex:${either(['[^_].*', ...SPECIAL_FOLDERS.map((name) => escaped(name))])}`;

const LISTED = SPECIAL_FOLDERS.map((name) => `\`${name}/\``).join(', ');

const EARLIER_SPELLINGS = Object.entries(RENAMED_FOLDERS)
    .filter(([earlier]) => earlier.startsWith('_'))
    .map(([earlier, now]) => `\`${earlier}/\` is \`${now}/\``)
    .join(', ');

const NAMES: NamesRule[] = [
    {
        ...taughtBy('specs-root-holds-specifications-and-shared'),
        fix: `move a file where it belongs: code into \`specs/${SETUP_FOLDER}/\` or the \`${SETUP_FOLDER}/\` of the one specification that reads it, data into the ground folder of its role`,
        ls: {
            '**/specs': specsRootFiles(),
            // invariant: below the specs root the root's file list no longer holds; any folder name is the closed-list rule's to judge.
            '**/specs/*': {},
        },
        name: 'specs-root-holds-specifications-and-shared',
    },
    {
        ...taughtBy('special-folder-in-closed-list'),
        fix: `rename it to the special folder that says what it holds (${LISTED}), or drop the \`_\` if it is a subject; an earlier spelling names its own (${EARLIER_SPELLINGS}), and what \`_shared/\` held sits in the special folders at the specs root`,
        ignore: SPECIAL_FOLDERS.map((name) => `**/${name}`),
        ls: { '**/specs/**': { '.dir': CLOSED_LIST } },
        name: 'special-folder-in-closed-list',
    },
    {
        ...taughtBy('spec-file-in-a-specs-tree'),
        fix: 'move it under `specs/<specification>/`, or rename it `.test.ts` in the `__tests__/` of the folder of the module it covers',
        ignore: ['specs', '**/specs'],
        ls: { '**': { '.*.spec.ts': 'exists:0', '.spec.ts': 'exists:0' } },
        name: 'spec-file-in-a-specs-tree',
    },
];

export const TEST_COMMENT_OPENINGS: readonly string[] = Object.freeze([
    'Given - ',
    'When - ',
    'Then - ',
    'And - ',
    'checker-disable',
    'testId:',
]);

// Stryker disable next-line LogicalOperator: the standard always states its test section; the type keeps every section optional
const TEST_STANDARD = STANDARD.test ?? {};

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
    isRecord(value) ? value : {};

// outside: the files a project's test section names for vitest to load by their path (the component project's `wrap`), which no import reaches.
function loadedByName(section: Readonly<Record<string, unknown>>): string[] {
    return Object.values(recordOf(section.projects)).flatMap((project) => {
        const { root, wrap } = recordOf(project);
        return typeof wrap === 'string'
            ? [posix.normalize(typeof root === 'string' ? posix.join(root, wrap) : wrap)]
            : [];
    });
}

export function testPreset(): Preset {
    return {
        baseline: [TEST_SECTION],
        layers: LAYERS,
        name: TEST_SECTION,
        names: NAMES,
        oxlint: {
            jsPlugins: ['@jterrazz/test/oxlint'],
            overrides: [importRulesForSpecifications, vitestOnTests],
            rules: {
                ...recommendedRules,
                'jterrazz-typescript/comment-states-its-kind': [
                    'error',
                    { openings: [...TEST_COMMENT_OPENINGS] },
                ],
            },
        },
        checker: {
            label: 'Test Conventions (@jterrazz/test)',
            module: createRequire(import.meta.url).resolve('#checker'),
        },
        derive: (root) => ({ projects: Object.fromEntries(derivedProjects(root)) }),
        entries: (section, root) => [...loadedByName(section), ...specificationModules(root)],
        loadedPackages: packagesLoadedFor,
        files: {
            'vitest.config.ts': {
                scope: 'unit',
                text: "import { vitestConfig } from '@jterrazz/test/vitest';\n\nexport default await vitestConfig(import.meta.url);\n",
            },
        },
        origins: [{ file: 'src/standard/standard.ts', settings: TEST_STANDARD }],
        package: '@jterrazz/test',
        settings: TEST_STANDARD,
    };
}
