import { join, resolve } from 'node:path';

import { treeEntries } from '../src/seams/git/tree.js';
import { cell, table } from './catalog.js';

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

/** The two trees of the spine that hold code a module test sits beside. */
const CODE_ROOTS = ['src', 'lint'];

/** Every path of the tree under `dir` git does not ignore, `/`-separated and prefixed by `at`. */
function listed(dir: string, at: string): string[] {
    const paths: string[] = [];
    for (const entry of treeEntries(dir)) {
        const path = `${at}/${entry.name}`;
        paths.push(path);
        if (entry.isDirectory()) {
            paths.push(...listed(join(dir, entry.name), path));
        }
    }
    return paths;
}

/** Every file of the code trees, `/`-separated and relative to the root. */
function codeFiles(root: string): string[] {
    return CODE_ROOTS.flatMap((tree) => listed(resolve(root, tree), tree));
}

/** Every source module, `/`-separated and relative to the root. */
function sources(root: string): string[] {
    return codeFiles(root).filter(
        (path) =>
            /\.tsx?$/u.test(path) &&
            !/\.(?:test|test-d|fixtures)\.tsx?$/u.test(path) &&
            !path.includes('/fixtures/'),
    );
}

/** The modules with no `<file>.test.ts(x)` beside them. */
export function siblingless(root: string): string[] {
    const all = new Set(codeFiles(root));
    return sources(root)
        .filter((path) => !all.has(path.replace(/\.(?<extension>tsx?)$/u, '.test.$<extension>')))
        .toSorted();
}

/** A kind whose paths are LISTED: adding a module never joins it by accident. */
const oneOf =
    (...paths: string[]) =>
    (path: string): boolean =>
        paths.includes(path);

/**
 * The declared kinds, first match wins.
 *
 * Every kind names its paths, or matches a shape the tree enforces
 * (`<facet>.chain.ts`, `<facet>.project.ts`). None of them is a prefix: a
 * kind claiming `src/seams/` would claim every module written there next
 * year too, and K7 would be a poster rather than a gate.
 */
export const SIBLINGLESS_KINDS: SiblinglessKind[] = [
    {
        claims: oneOf(
            'src/index.ts',
            'src/surface.ts',
            'src/browser/index.ts',
            'src/runner/index.ts',
        ),
        name: 'composition root or barrel',
        why: 'it wires and re-exports; what it publishes is held by `package-exports.test.ts` and by every spec that imports the entry',
    },
    {
        claims: oneOf(
            'src/model/contracts/exchange.ts',
            'src/model/ports/browser.port.ts',
            'src/model/ports/cli.port.ts',
            'src/model/ports/container.port.ts',
            'src/model/ports/database.port.ts',
            'src/model/ports/device.port.ts',
            'src/model/ports/isolation.port.ts',
            'src/model/ports/server.port.ts',
            'src/model/ports/service.port.ts',
            'src/settings.ts',
            'lint/config-shape.ts',
            'lint/oxlint-api.ts',
        ),
        name: 'type-only declaration',
        why: 'it declares a shape and executes nothing; the compiler is its test, and `type-channel.test-d.ts` holds what the compiler must refuse',
    },
    {
        claims: oneOf('src/model/artifacts/artifacts.ts', 'lint/manifest.ts', 'lint/rule-code.ts'),
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
        claims: oneOf('src/facets/mobile/appium-server.ts', 'src/facets/mobile/mobile.handle.ts'),
        name: 'a mobile module that needs a device',
        why: 'the mobile facet has no tree under `specs/` and cannot have one here (M1); what a device is NOT needed for — resolving the simulator, projecting the page source, wording the ambiguity — has its own sibling test, and these two are the rest',
    },
    {
        claims: oneOf(
            'src/facets/api/api.handle.ts',
            'src/facets/cli/cli.handle.ts',
            'src/facets/cli/literate.ts',
            'src/facets/component/component.handle.ts',
            'src/facets/component/rendered-text.ts',
            'src/facets/integration/integration.handle.ts',
            'src/facets/jobs/jobs.handle.ts',
            'src/facets/website/website.handle.ts',
        ),
        name: 'a facet module',
        why: 'the facet is proven end to end by its own tree under `specs/<facet>/`, which is what the constructor exists to make possible',
    },
    {
        claims: oneOf(
            'src/model/result/directory.ts',
            'src/model/result/filesystem.ts',
            'src/model/result/json.ts',
            'src/model/result/match-options.ts',
            'src/model/result/response.ts',
            'src/model/result/table.ts',
            'src/model/result/text.ts',
        ),
        name: 'a result accessor',
        why: 'an accessor is what a terminal action hands back: it is exercised by every spec that asserts on a result, and `result.test.ts` holds the base',
    },
    {
        claims: oneOf(
            'src/seams/docker/container-accessor.ts',
            'src/seams/docker/docker-lookup.ts',
            'src/seams/hono/hono.adapter.ts',
            'src/seams/msw/handlers.ts',
            'src/seams/msw/server.ts',
            'src/seams/msw/worker.ts',
            'src/seams/playwright/playwright.adapter.ts',
            'src/seams/vitest-browser/commands.ts',
            'src/seams/vitest-browser/golden.ts',
            'src/seams/vitest-browser/page-runtime.ts',
            'src/seams/vitest-browser/ui.ts',
            'src/seams/vitest-browser/vitest-browser.adapter.ts',
        ),
        name: 'a seam adapter',
        why: 'a seam is proven through the facet that drives it — a probe that could only reach it directly is an integration spec under `specs/integration/<seam>/` (chapter 03)',
    },
    {
        claims: oneOf('lint/catalog-cli.ts', 'lint/checker-cli.ts', 'lint/coverage-cli.ts'),
        name: 'a bundled CLI entry',
        why: 'it is argument parsing over a module that has its own tests, and `specs/lint/` runs the built binary end to end',
    },
    {
        claims: oneOf(
            'lint/catalog.ts',
            'lint/checker-facets.ts',
            'lint/checker-placement.ts',
            'lint/checker-sharing.ts',
            'lint/fs-cache.ts',
        ),
        name: 'a lint-layer module',
        why: 'the lint layer is proven by the rule tests beside each rule and by `specs/lint/`, which runs the real oxlint binary and the real checker over fixture projects',
    },
    {
        claims: oneOf(
            'src/model/chain/docker-reader.ts',
            'src/model/chain/ground.ts',
            'src/model/chain/registry.ts',
            'src/model/chain/services.ts',
            'src/model/contracts/stream.ts',
            'src/model/timing/pause.ts',
            'src/runner/facet-project.ts',
        ),
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

/** Markers delimiting the generated kind table inside `docs/03-testing.md`. */
export const SIBLINGS_START =
    '<!-- GENERATED:siblings — do not edit by hand; run `npm run docs`. Source: lint/siblings.ts -->';
export const SIBLINGS_END = '<!-- /GENERATED:siblings -->';

/** The kind table, generated: one row per kind, with today's count and its reason. */
export function renderSiblings(root: string): string {
    const rows = classified(root);
    const total = rows.length;
    const body = SIBLINGLESS_KINDS.map((kind) => [
        cell(`${kind.name} (${rows.filter((row) => row.kind === kind).length})`),
        cell(kind.why),
    ]);
    return [
        `Today **${total} modules** have no sibling test, and every one of them is claimed:`,
        '',
        ...table(['Kind', 'Proven instead by'], body),
    ].join('\n');
}

/** Replace the region between the GENERATED:siblings markers of chapter 03. */
export function spliceSiblings(existing: string, root: string): string {
    const start = existing.indexOf(SIBLINGS_START);
    const end = existing.indexOf(SIBLINGS_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/03-testing.md is missing the GENERATED:siblings markers (${SIBLINGS_START} … ${SIBLINGS_END})`,
        );
    }
    return `${existing.slice(0, start) + SIBLINGS_START}\n\n${renderSiblings(root)}\n\n${existing.slice(end)}`;
}
