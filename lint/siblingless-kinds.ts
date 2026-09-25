/**
 * The declared kinds of module that need no sibling test — the table
 * `siblings.ts` classifies every siblingless module by, and chapter 03
 * publishes. Each kind carries the one line that says where its proof is.
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

/** A kind whose paths are LISTED: adding a module never joins it by accident. */
const oneOf =
    (...paths: string[]) =>
    (path: string): boolean =>
        paths.includes(path);

/**
 * The declared kinds, first match wins.
 *
 * Every kind names its paths, or matches a shape the tree enforces
 * (`<facet>.chain.ts`, `projects/<facet>.project.ts`). None of them is a prefix: a
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
            'src/actions/render/page.port.ts',
            'src/actions/render/scenario.ts',
            'src/actions/signatures.ts',
            'src/capabilities/clock/clock.port.ts',
            'src/capabilities/env/env.capability.ts',
            'src/capabilities/fixture/fixture.capability.ts',
            'src/capabilities/fixture/fixture.port.ts',
            'src/capabilities/headers/headers.capability.ts',
            'src/capabilities/intercept/intercept.port.ts',
            'src/capabilities/seed/seed.port.ts',
            'src/capabilities/signatures.ts',
            'src/capabilities/viewport/viewport.capability.ts',
            'src/capabilities/viewport/viewport.port.ts',
            'src/capabilities/wrap/wrap.capability.ts',
            'src/facets/chain.ts',
            'src/model/chain/config.ts',
            'src/model/ports/browser.port.ts',
            'src/model/ports/cli.port.ts',
            'src/model/ports/container.port.ts',
            'src/model/ports/database.port.ts',
            'src/model/ports/device.port.ts',
            'src/model/ports/isolation.port.ts',
            'src/model/ports/server.port.ts',
            'src/model/ports/service.port.ts',
            'src/settings.ts',
            'src/stubs/exchange.ts',
            'lint/config-shape.ts',
        ),
        name: 'type-only declaration',
        why: 'it declares a shape and executes nothing; the compiler is its test, and `type-channel.test-d.ts` holds what the compiler must refuse',
    },
    {
        claims: oneOf(
            'src/capabilities/with/with.capability.ts',
            'src/model/artifacts/artifacts.ts',
            'src/model/services/service-images.ts',
            'lint/manifest.ts',
            'lint/rule-code.ts',
            'lint/self-layers.ts',
            'lint/self-manifest.ts',
            'lint/self/architecture-rows.ts',
            'lint/siblingless-kinds.ts',
        ),
        name: 'constant data',
        why: 'it is a table, not a behaviour; every reader of it asserts on it (`preset.test.ts` for the artefact paths, `plugin.test.ts` for the manifests, `make lint` for the layer map, which judges every module by it, `siblings.test.ts` for these kinds, `define-facet.test.ts` for the `with()` declaration)',
    },
    {
        claims: (path) => /^src\/facets\/[a-z]+\/[a-z]+\.chain\.ts$/u.test(path),
        name: 'the facet file set, as a re-export',
        why: 'each names the chain its constructor hands out rather than implementing it — the builder the node facets not yet composed share, or a composition (`jobs`) — and `builder.test.ts`, the facet specs and `facet-matrix.test.ts` hold the thing they name',
    },
    {
        claims: (path) => /^src\/runner\/projects\/[a-z]+\.project\.ts$/u.test(path),
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
            'src/actions/run/literate.ts',
            'src/facets/api/api.facet.ts',
            'src/facets/api/api.handle.ts',
            'src/facets/cli/cli.facet.ts',
            'src/facets/cli/cli.handle.ts',
            'src/facets/component/component.facet.ts',
            'src/facets/component/component.handle.ts',
            'src/facets/integration/integration.facet.ts',
            'src/facets/integration/integration.handle.ts',
            'src/facets/jobs/jobs.facet.ts',
            'src/facets/jobs/jobs.handle.ts',
            'src/facets/mobile/mobile.facet.ts',
            'src/facets/website/website.facet.ts',
            'src/facets/website/website.handle.ts',
        ),
        name: 'a facet module',
        why: 'the facet is proven end to end by its own tree under `specs/<facet>/`, which is what the constructor exists to make possible',
    },
    {
        claims: oneOf(
            'src/model/goldens/match-options.ts',
            'src/results/container.ts',
            'src/results/directory.ts',
            'src/results/fetch.result.ts',
            'src/results/filesystem.ts',
            'src/results/http.result.ts',
            'src/results/jobs.result.ts',
            'src/results/json.ts',
            'src/results/page.result.ts',
            'src/results/render.result.ts',
            'src/results/rendered-text.ts',
            'src/results/response.ts',
            'src/results/screen.result.ts',
            'src/results/table.ts',
            'src/results/text.ts',
        ),
        name: 'a result accessor',
        why: 'an accessor is what a terminal action hands back: it is exercised by every spec that asserts on a result, and `result.test.ts` holds the base',
    },
    {
        claims: oneOf(
            'src/seams/docker/docker-lookup.ts',
            'src/seams/fs/database-set.ts',
            'src/seams/hono/hono.adapter.ts',
            'src/seams/msw/handlers.ts',
            'src/seams/msw/msw-node.ts',
            'src/seams/msw/server.ts',
            'src/seams/msw/worker.ts',
            'src/seams/playwright/playwright.adapter.ts',
            'src/seams/postgres/template.ts',
            'src/seams/vitest/clock.engine.ts',
            'src/seams/vitest-browser/clock.engine.ts',
            'src/seams/vitest-browser/commands.ts',
            'src/seams/vitest-browser/golden.ts',
            'src/seams/vitest-browser/page-runtime.ts',
            'src/seams/vitest-browser/ui.ts',
            'src/seams/vitest-browser/vitest-browser.adapter.ts',
            'src/seams/vitest-browser/viewport.engine.ts',
        ),
        name: 'a seam adapter',
        why: 'a seam is proven through the facet that drives it — a probe that could only reach it directly is an integration spec under `specs/integration/<seam>/` (chapter 03)',
    },
    {
        claims: oneOf(
            'lint/catalog-cli.ts',
            'lint/checker-cli.ts',
            'lint/coverage-cli.ts',
            'lint/self-checker-cli.ts',
            'src/runner/route-split-cli.ts',
        ),
        name: 'a bundled CLI entry',
        why: 'it is argument parsing over a module that has its own tests, and `specs/lint/` runs the built binary end to end',
    },
    {
        claims: oneOf(
            'lint/carried.ts',
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
            'src/model/chain/action.ts',
            'src/model/chain/capability.ts',
            'src/model/chain/ground.ts',
            'src/model/chain/state.ts',
            'src/model/services/database-option.ts',
            'src/model/services/registry.ts',
            'src/model/services/services.ts',
            'src/model/timing/pause.ts',
            'src/runner/facet-project.ts',
            'src/stubs/stream.ts',
        ),
        name: 'a chain or runner internal',
        why: 'it is reached through the chain, so its proof is the facet specs that drive the chain — a direct test would assert on a seam nothing else speaks to',
    },
];
