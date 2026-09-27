import type { ArchitectureRule, NamesRule, Preset } from '@jterrazz/typescript/config';
import type { OxlintConfig } from '@jterrazz/typescript/oxlint';
import {
    declaredSubpaths,
    firstSentence,
    GROUND_FOLDERS,
    readAt,
    RESERVED_FOLDERS,
    rowNamed,
    SETUP_FOLDER,
    SHARED_FOLDER,
} from '@jterrazz/typescript/rules';

import type { TestSettings } from '../../engine/project/settings.js';
import { CATALOGUE_CHAPTER } from '../catalogue/chapter.js';
import { consumerRows, recommendedRules } from '../catalogue/manifest.js';
import { importRulesForSpecifications } from './import.js';
import { vitestOnTests } from './vitest.js';

type Lesson = Pick<ArchitectureRule, 'read' | 'why'>;

function lessonOf(name: string): Lesson {
    const row = rowNamed(consumerRows, name);

    return { read: readAt(row, CATALOGUE_CHAPTER), why: firstSentence(row.sentence) };
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
        fix: '`component.render()` and the element vocabulary render in a real browser — the queries are the same nouns, and they run against what ships',
        packages: ['@testing-library/*'],
        seam: 'renderer',
    },
    {
        fix: 'a drawing of a browser proves what a browser does not — a rendered thing is a `.test.tsx` beside its component, collected by `component()`',
        packages: ['happy-dom', 'jsdom'],
        seam: 'simulated-dom',
    },
    {
        fix: 'Browser Mode is the seam, not the surface — `component.render()` owns the locators, the visitor and the ARIA tree',
        packages: ['vitest/browser', 'vitest-browser-*', '@vitest/browser*'],
        seam: 'browser-mode',
    },
    {
        fix: 'the network answers through stubs — `await using _ = await intercept(defineStubs(…))` in module scope, `.intercept()` on a chain',
        packages: ['msw', 'nock'],
        seam: 'network',
    },
    {
        fix: 'the doubles ladder is closed — `mockOf<Port>()` for an injected interface, `vi.fn()` for a function, `vi.spyOn` for an object the test passes in',
        packages: ['sinon', 'vitest-mock-extended'],
        seam: 'doubles',
    },
    {
        fix: 'vitest is the runner this vocabulary speaks — `test`, `expect` and `vi` come from it',
        packages: ['jest', '@jest/*'],
        seam: 'runner',
    },
    {
        fix: 'time is one primitive — `using _ = clock.at(iso)` pins the calendar and gives it back at the end of the scope',
        packages: ['mockdate'],
        seam: 'clock',
    },
    {
        fix: 'the website facet drives the browser — `specification.website()` owns the page, and the peer is its',
        packages: ['playwright', 'playwright-core', '@playwright/test'],
        seam: 'browser',
    },
    {
        fix: 'the mobile facet drives the simulator — `specification.mobile()` owns the session, and the peers are its',
        packages: ['webdriverio', 'appium'],
        seam: 'simulator',
    },
    {
        fix: 'a component rendered to a string is still a component — the test is a `.test.tsx` beside it, and `result.html` carries the markup',
        from: String.raw`\.test\.ts$`,
        packages: ['react-dom/server'],
        seam: 'string-renderer',
    },
];

const secondRuntime = lessonOf('no-second-test-runtime');

function publishedFix(): string {
    const published = declaredSubpaths('@jterrazz/test', import.meta.dirname);

    return `import from "@jterrazz/test"; the published subpaths are ${published.length === 0 ? 'none' : published.join(', ')}`;
}

const LAYERS: ArchitectureRule[] = [
    {
        ...lessonOf('no-test-to-test-import'),
        fix: 'under `specs/`, move what both read into the `_setup/` of the lowest folder they share; under `src/`, into a sibling `<file>.fixtures.ts` for typed input data',
        from: { path: TEST_FILE },
        name: 'no-test-to-test-import',
        to: { path: String.raw`\.test\.[cm]?[jt]sx?$` },
    },
    {
        ...lessonOf('fixtures-imported-by-tests-only'),
        fix: 'import it from a `*.test.ts` only, or move what the file needs into a module of its own',
        from: { pathNot: TEST_FILE },
        name: 'fixtures-imported-by-tests-only',
        to: { path: String.raw`\.fixtures${SOURCE}` },
    },
    ...SEAMS.map((seam): ArchitectureRule => ({
        fix: seam.fix,
        from: { path: seam.from ?? RUNS_A_TEST },
        name: `no-second-test-runtime-${seam.seam}`,
        read: secondRuntime.read,
        to: { path: packages(seam.packages) },
        why: secondRuntime.why,
    })),
    {
        ...lessonOf('no-unpublished-subpath'),
        fix: publishedFix(),
        from: {},
        name: 'no-unpublished-subpath',
        to: { couldNotResolve: true, path: '^@jterrazz/test/' },
    },
];

/** RE2 has no negative lookahead: "any name but this one" is spelled as the names that differ from it at some character, or in length. */
function anyNameBut(word: string): string {
    const prefixes = Array.from({ length: word.length }, (_, index) => word.slice(0, index));
    const differing = prefixes.map(
        (prefix) => `${escaped(prefix)}[^${escaped(word.charAt(prefix.length))}].*`,
    );
    const shorter = prefixes.filter(Boolean).map((prefix) => escaped(prefix));

    return either([...differing, ...shorter, `${escaped(word)}.+`]);
}

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

function specsRootFiles(): Record<string, string> {
    const refused = ANY_OTHER_FILE.map((key): [string, string] => [key, 'exists:0']);
    const held = AT_THE_SPECS_ROOT.flatMap((key): [string, string][] => [
        [key, 'regex:.+'],
        [`.*${key}`, 'regex:.+'],
    ]);

    return Object.fromEntries([...refused, ...held]);
}

const CLOSED_LIST = `regex:${either(['[^_].*', ...RESERVED_FOLDERS.map((name) => escaped(name))])}`;

const NAMES: NamesRule[] = [
    {
        ...lessonOf('specs-root-holds-facets-and-shared'),
        fix: `move a file where it belongs — code into \`specs/${SHARED_FOLDER}/${SETUP_FOLDER}/\` or the \`${SETUP_FOLDER}/\` of the one facet that reads it, data into the ground folder of its role — and a \`${SETUP_FOLDER}/\` to \`specs/${SHARED_FOLDER}/${SETUP_FOLDER}/\``,
        ls: {
            '**/specs': specsRootFiles(),
            '**/specs/*': { '.dir': `regex:${anyNameBut(SETUP_FOLDER)}` },
            '**/specs/*/*': { '.dir': 'regex:.+' },
        },
        name: 'specs-root-holds-facets-and-shared',
    },
    {
        ...lessonOf('underscore-name-in-closed-list'),
        fix: `rename it to the reserved folder that says what it holds — ${RESERVED_FOLDERS.map((name) => `\`${name}/\``).join(', ')} — or drop the \`_\` if it is a subject`,
        ignore: [
            `**/${SETUP_FOLDER}`,
            `**/specs/${SHARED_FOLDER}`,
            ...GROUND_FOLDERS.map((name) => `**/${name}`),
        ],
        ls: { '**/specs/**': { '.dir': CLOSED_LIST } },
        name: 'underscore-name-in-closed-list',
    },
    {
        ...lessonOf('spec-file-in-a-specs-tree'),
        fix: 'move it under `specs/<facet>/`, or rename it `.test.ts` beside the module it covers',
        ignore: ['specs', '**/specs'],
        ls: { '**': { '.*.spec.ts': 'exists:0', '.spec.ts': 'exists:0' } },
        name: 'spec-file-in-a-specs-tree',
    },
];

export const TESTING_PRESET_OXLINT: OxlintConfig = {
    jsPlugins: ['@jterrazz/test/oxlint'],
    overrides: [importRulesForSpecifications, vitestOnTests],
    rules: recommendedRules,
};

const DEFAULTS: Required<Pick<TestSettings, 'collections' | 'methodless' | 'production'>> = {
    collections: [],
    methodless: [],
    production: { allow: {} },
};

export function testPreset(): Preset {
    return {
        baseline: ['test', 'test.coverage'],
        floors: ['test.coverage'],
        layers: LAYERS,
        name: 'test',
        names: NAMES,
        oxlint: TESTING_PRESET_OXLINT,
        package: '@jterrazz/test',
        settings: DEFAULTS,
    };
}
