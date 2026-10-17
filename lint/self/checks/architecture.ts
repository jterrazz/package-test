import type { ArchitectureRule } from '@jterrazz/typescript/config';
import { GROUND_FOLDERS } from '@jterrazz/typescript/rules';
import type { ChapterAnchor } from '@jterrazz/typescript/rules';

import { TEST_SUFFIX } from '../../kit/project/source.js';
import { FRAMEWORK_LAYERS } from './layers.js';
import type { LayerOptions } from './layers.js';
import { OWNERS_OF_LIBRARIES } from './libraries.js';

const READ_LAYERS: ChapterAnchor = 'docs/concepts/architecture.md#the-source-trees';

const SPAWNING_SITES = [
    'disk/npm-packed.adapter.ts',
    'expectations/command/docker-cli.ts',
    'expectations/in-place/formatter.ts',
    'specifications/cli/process/exec.adapter.ts',
    'specifications/lint/local-linters.adapter.ts',
    'specifications/mobile/server/simulator.ts',
    'services/process/serve.ts',
];

const TEST_MATERIAL = `${TEST_SUFFIX.source}|/(${GROUND_FOLDERS.join('|')})/`;

const LOCAL_DEPENDENCY: NonNullable<ArchitectureRule['to']['dependencyTypes']> = [
    'local',
    'aliased',
    'aliased-subpath-import',
    'aliased-tsconfig',
    'aliased-tsconfig-base-url',
    'aliased-tsconfig-paths',
    'aliased-workspace',
    'undetermined',
];

const PACKAGE_DEPENDENCY: NonNullable<ArchitectureRule['to']['dependencyTypes']> = [
    'npm',
    'npm-dev',
    'npm-peer',
    'npm-optional',
    'npm-no-pkg',
    'npm-unknown',
    'npm-bundled',
];

const escaped = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const ruleName = (...words: string[]): string =>
    words
        .join('-')
        .replaceAll(/[^a-z0-9]+/gu, '-')
        .replaceAll(/^-|-$/gu, '');

const either = (patterns: readonly string[]): string =>
    patterns.length === 0 ? '$^' : patterns.map((pattern) => `(${pattern})`).join('|');

function treeOf(layer: string): string {
    return layer === 'lint' ? 'lint/' : `src/${layer}/`;
}

// invariant: a declared path as the map writes it: `chain/` a folder, `chain/refusals/rows` one module, relative to `src/` unless it opens on `lint/`.
function targetOf(path: string): string {
    const rooted = path.startsWith('lint/') ? path : `src/${path}`;

    return path.endsWith('/')
        ? `^${escaped(rooted)}`
        : String.raw`^${escaped(rooted.replace(/\.tsx?$/u, ''))}\.tsx?$`;
}

function packageOf(name: string): string {
    return `node_modules/${escaped(name)}/`;
}

// invariant: a grant names the package a subpath belongs to: its `exports` land every subpath in the package's own folder, wherever the file sits.
function grantOf(name: string): string {
    const segments = name.split('/');

    return packageOf(segments.slice(0, name.startsWith('@') ? 2 : 1).join('/'));
}

type Unit = { imports: string[]; packages: string[]; path: string; reach: string; seams: string[] };

function unitsOf(layer: string, options: LayerOptions): Unit[] {
    const tree = treeOf(layer);
    const seams = Object.keys(options.seams ?? {}).map((seam) => targetOf(seam));
    const own = { imports: options.imports ?? [], packages: options.packages ?? [] };
    const folders = Object.entries(options.folders ?? {}).map(([folder, packages]) => ({
        imports: [...own.imports, `${layer}/${folder}/`],
        packages: [...own.packages, ...packages],
        path: `^${escaped(`${tree}${folder}/`)}`,
        reach: `${tree}${folder}/`,
        seams,
    }));
    const folderPaths = folders.map(({ path }) => path);

    return [
        ...folders,
        {
            ...own,
            path: `^${escaped(tree)}`,
            reach: tree,
            seams: [...seams, ...folderPaths],
        },
        ...Object.entries(options.seams ?? {}).map(([seam, extra]) => {
            const folder = options.folders === undefined ? undefined : seam.split('/')[1];
            const inFolder = folder === undefined ? [] : [`${layer}/${folder}/`];

            return {
                imports: [...own.imports, ...inFolder, ...extra],
                packages: [...own.packages, ...(options.folders?.[folder ?? ''] ?? [])],
                path: targetOf(seam),
                reach: seam,
                seams: [],
            };
        }),
    ];
}

function layerRules(layer: string, options: LayerOptions): ArchitectureRule[] {
    return unitsOf(layer, options).flatMap(({ imports, packages, path, reach, seams }) => {
        const from = { path, pathNot: either([TEST_MATERIAL, ...seams]) };

        return [
            {
                fix: 'reach it through a layer the map allows, or declare the edge in `FRAMEWORK_LAYERS` with its reason',
                from,
                name: ruleName('layer', reach, 'imports-within-its-map'),
                read: READ_LAYERS,
                to: {
                    dependencyTypes: LOCAL_DEPENDENCY,
                    pathNot: either(imports.map((one) => targetOf(one))),
                },
                why: `\`${reach}\` reaches only what \`FRAMEWORK_LAYERS\` grants it: chain ← visitor · expectations · stubs · services · disk · clock · mocks ← vitest ← specifications ← the entries`,
            },
            {
                fix: 'import it from the slice that owns it, or declare the package on the layer in `FRAMEWORK_LAYERS` with its reason',
                from,
                name: ruleName('layer', reach, 'uses-its-declared-packages'),
                read: READ_LAYERS,
                to: {
                    dependencyTypes: PACKAGE_DEPENDENCY,
                    pathNot: either(packages.map((name) => grantOf(name))),
                },
                why: `\`${reach}\` depends only on the packages \`FRAMEWORK_LAYERS\` declares for it`,
            },
        ] satisfies ArchitectureRule[];
    });
}

function ownerRules(): ArchitectureRule[] {
    return Object.entries(OWNERS_OF_LIBRARIES).map(([library, owners]) => ({
        fix: `reach \`${library}\` through the port \`${owners.join('` or `')}\` implements, handed in by the specification — or import only what the owner exports`,
        from: {
            path: '^(src|lint)/',
            pathNot: either([
                TEST_MATERIAL,
                ...owners.map((owner) => targetOf(owner.replace(/^src\//u, ''))),
            ]),
        },
        name: ruleName('library', library, 'has-one-owner'),
        read: 'docs/concepts/architecture.md#the-source-trees',
        to: { path: packageOf(library) },
        why: 'a library imported from two slices is two adapters of it that drift, and an optional peer loaded where its owner did not ask is a missing-peer refusal nobody wrote',
    }));
}

const RUNNER_CONFIG_ENTRY = 'src/index.vitest.ts';

type Reader = { granted: string[]; path: string };

// invariant: who, outside a specification, reaches which file of one: every edge `FRAMEWORK_LAYERS` grants into `specifications/`, keyed by the reader.
function specificationReaders(): Map<string, Reader> {
    const readers = new Map<string, Reader>();
    const grant = (reader: string, path: string, granted: string): void => {
        const known = readers.get(reader) ?? { granted: [], path };
        readers.set(reader, { ...known, granted: [...known.granted, granted] });
    };
    for (const [layer, options] of Object.entries<LayerOptions>(FRAMEWORK_LAYERS)) {
        for (const path of (options.imports ?? []).filter((one) =>
            one.startsWith('specifications/'),
        )) {
            grant(treeOf(layer), `^${escaped(treeOf(layer))}`, path);
        }
        for (const [module, paths] of Object.entries(options.seams ?? {})) {
            for (const path of paths.filter((one) => one.startsWith('specifications/'))) {
                grant(module, targetOf(module), path);
            }
        }
    }
    grant(
        RUNNER_CONFIG_ENTRY,
        `^${escaped(RUNNER_CONFIG_ENTRY)}$`,
        'specifications/*/<specification>.project',
    );

    return readers;
}

function grantedTargets(paths: readonly string[]): string[] {
    return paths.map((path) => {
        if (path === 'specifications/*/<specification>.project') {
            return String.raw`^src/specifications/([^/]+)/[^/]+\.project\.ts$`;
        }

        return path === 'specifications/'
            ? String.raw`^src/specifications/[^/]+/[^/]+\.composition\.ts$`
            : targetOf(path);
    });
}

function specificationRules(): ArchitectureRule[] {
    const face = String.raw`^src/specifications/[^/]+/[^/]+\.face(\.browser)?\.ts$`;
    const readers = specificationReaders();
    const outside: Pick<ArchitectureRule, 'fix' | 'read' | 'why'> = {
        fix: 'import it from the specification’s face — export it from `src/specifications/<specification>/<specification>.face.ts` — or move it below the specifications',
        read: READ_LAYERS,
        why: 'a specification is entered from outside by its face, and a concept folder reached from outside is an internal that can no longer move',
    };

    return [
        {
            fix: 'move what the two specifications share below the specifications — to `chain/` or the notion it is (`visitor/`, `expectations/`, `stubs/`, `services/`, `disk/`, `clock/`, `mocks/`) — and import it from there',
            from: { path: '^src/specifications/([^/]+)/', pathNot: TEST_MATERIAL },
            name: 'specification-imports-no-other-specification',
            read: READ_LAYERS,
            to: { path: '^src/specifications/[^/]+/', pathNot: '^src/specifications/$1/' },
            why: 'a specification reaching into a sibling is the coupling the slices exist to prevent',
        },
        {
            ...outside,
            from: {
                path: '^(src|lint)/',
                pathNot: either([
                    TEST_MATERIAL,
                    '^src/specifications/[^/]+/',
                    ...[...readers.values()].map(({ path }) => path),
                ]),
            },
            name: 'specification-entered-by-its-face',
            to: { path: '^src/specifications/[^/]+/', pathNot: face },
        },
        ...[...readers].map(([reader, { granted, path }]) => ({
            fix: outside.fix,
            from: { path, pathNot: TEST_MATERIAL },
            read: outside.read,
            why: outside.why,
            name: ruleName('specification-entered-by-its-face-from', reader),
            to: {
                path: '^src/specifications/[^/]+/',
                pathNot: either([face, ...grantedTargets(granted)]),
            },
        })),
    ];
}

/** This package's layer map, the edges `FRAMEWORK_LAYERS` and `OWNERS_OF_LIBRARIES` declare (the direction of `lint/` is the base preset's), in dependency-cruiser's vocabulary: `jterrazz.config.ts` hands it to the toolchain's Architecture pass. */
export const ARCHITECTURE: readonly ArchitectureRule[] = Object.freeze([
    ...Object.entries<LayerOptions>(FRAMEWORK_LAYERS).flatMap(([layer, options]) =>
        layerRules(layer, options),
    ),
    ...ownerRules(),
    ...specificationRules(),
    {
        fix: "spawn it from the concept folder that owns the program, or, inside `services/`, through `services/process/serve.ts`'s `runToCompletion`",
        from: { path: '^src/', pathNot: either([TEST_MATERIAL, ...SPAWNING_SITES.map(targetOf)]) },
        name: 'process-spawned-by-its-program-owner',
        read: READ_LAYERS,
        to: {
            dependencyTypes: ['core'],
            dependencyTypesNot: ['type-only'],
            path: '^(node:)?child_process$',
        },
        why: 'each program the framework runs has one module that spawns it, so its lifecycle, its options and its errors have one owner (ADR-009)',
    },
    {
        fix: 'reach the framework through `@jterrazz/test`, the build an install holds, or move the probe into the `__tests__/` of the folder of the module it covers, as a module test',
        from: { path: '(^|/)specs/' },
        name: 'no-framework-internals',
        read: 'docs/guides/test.md#a-spec-reaches-the-framework-by-its-entry',
        to: { dependencyTypesNot: ['aliased'], path: '^src/' },
        why: "a spec of the framework specifies what a consumer installs, through its published name: the source tree, its entries among it, is this repository's alone",
    },
]);
