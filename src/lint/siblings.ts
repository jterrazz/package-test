import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The modules with no `<file>.test.ts` beside them, and what proves each one.
 *
 * I2 says a module test lives beside its module; it does not say every module
 * has one, and it cannot: a barrel executes nothing, a `*.port.ts` declares a
 * shape, and a facet's constructor is proven by the tree that constructs it.
 * The defect this module exists to stop is the OTHER kind of silence — a module
 * with real behaviour, no sibling test, and nobody able to say what covers it.
 *
 * So every siblingless module falls into one declared kind, each carrying the
 * one line that says where its proof is. A module that matches none of them
 * fails `siblings.test.ts`: write the test, or write the kind and defend it.
 *
 * The kinds are ORDERED — the first match wins — because a facet's
 * `<facet>.result.ts` is both a facet file and a re-export, and the narrower
 * reading is the true one.
 */

/** One reason a module needs no sibling test, and the paths it covers. */
export type SiblinglessKind = {
    /** A path (relative to the repository root, `/`-separated) this kind claims. */
    claims: (path: string) => boolean;
    /** What this kind is called in the chapter. */
    name: string;
    /** One line: where the proof is instead. */
    why: string;
};

/** Every source module, `/`-separated and relative to the root. */
function sources(root: string): string[] {
    return readdirSync(resolve(root, 'src'), { recursive: true })
        .map((entry) => `src/${String(entry).replaceAll('\\', '/')}`)
        .filter(
            (path) =>
                /\.tsx?$/u.test(path) &&
                !/\.(?:test|test-d|fixtures)\.tsx?$/u.test(path) &&
                !path.includes('/_fixtures/'),
        );
}

/** The modules with no `<file>.test.ts(x)` beside them. */
export function siblingless(root: string): string[] {
    const all = new Set(
        readdirSync(resolve(root, 'src'), { recursive: true }).map(
            (entry) => `src/${String(entry).replaceAll('\\', '/')}`,
        ),
    );
    return sources(root)
        .filter((path) => !all.has(path.replace(/\.(?<extension>tsx?)$/u, '.test.$<extension>')))
        .toSorted();
}

/** True when the path is inside one of the given `src/` folders. */
const under =
    (...prefixes: string[]) =>
    (path: string): boolean =>
        prefixes.some((prefix) => path.startsWith(prefix));

/** The declared kinds, first match wins. */
export const SIBLINGLESS_KINDS: SiblinglessKind[] = [
    {
        claims: (path) =>
            [
                'src/index.ts',
                'src/surface.ts',
                'src/browser/index.ts',
                'src/runner/index.ts',
            ].includes(path),
        name: 'composition root or barrel',
        why: 'it wires and re-exports; what it publishes is held by `package-exports.test.ts` and by every spec that imports the entry',
    },
    {
        claims: (path) =>
            under('src/core/ports/')(path) ||
            [
                'src/core/contracts/types.ts',
                'src/lint/types.ts',
                'src/lint/config-shape.ts',
            ].includes(path),
        name: 'type-only declaration',
        why: 'it declares a shape and executes nothing; the compiler is its test, and `type-channel.test-d.ts` holds what the compiler must refuse',
    },
    {
        claims: (path) =>
            [
                'src/core/artifacts/artifacts.ts',
                'src/lint/manifest.ts',
                'src/lint/rule-code.ts',
            ].includes(path),
        name: 'constant data',
        why: 'it is a table, not a behaviour; every reader of it asserts on it (`preset.test.ts` for the artefact paths, `plugin.test.ts` for the manifest)',
    },
    {
        claims: (path) => /^src\/facets\/[a-z]+\/[a-z]+\.(?:chain|result)\.ts$/u.test(path),
        name: 'the facet file set, as a re-export',
        why: 'the six node facets share one builder, so these name it rather than implement it — `builder.test.ts` and `facet-matrix.test.ts` hold the thing they name',
    },
    {
        claims: (path) => /^src\/facets\/[a-z]+\/[a-z]+\.project\.ts$/u.test(path),
        name: "a facet's vitest project",
        why: '`projects.test.ts` builds every one of them and asserts the project it produces',
    },
    {
        claims: under('src/facets/'),
        name: 'a facet module',
        why: 'the facet is proven end to end by its own tree under `specs/<facet>/`, which is what the constructor exists to make possible (M1)',
    },
    {
        claims: under('src/core/result/'),
        name: 'a result accessor',
        why: 'an accessor is what a terminal action hands back: it is exercised by every spec that asserts on a result, and `result.test.ts` holds the base',
    },
    {
        claims: under('src/seams/'),
        name: 'a seam adapter',
        why: 'a seam is proven through the facet that drives it — a probe that could only reach it directly is an integration spec under `specs/integration/<seam>/` (chapter 03)',
    },
    {
        claims: (path) => /^src\/lint\/[a-z-]+-cli\.ts$/u.test(path),
        name: 'a bundled CLI entry',
        why: 'it is argument parsing over a module that has its own tests, and `specs/lint/` runs the built binary end to end',
    },
    {
        claims: under('src/lint/'),
        name: 'a lint-layer module',
        why: 'the lint layer is proven by the rule tests beside each rule and by `specs/lint/`, which runs the real oxlint binary and the real checker over fixture projects',
    },
    {
        claims: under('src/core/', 'src/runner/'),
        name: 'a chain or runner internal',
        why: 'it is reached through the chain, so its proof is the facet specs that drive the chain — a direct test would assert on a seam nothing else speaks to',
    },
];

/** Each siblingless module paired with the first kind that claims it. */
export function classified(root: string): { kind: SiblinglessKind | undefined; path: string }[] {
    return siblingless(root).map((path) => ({
        kind: SIBLINGLESS_KINDS.find((candidate) => candidate.claims(path)),
        path,
    }));
}
