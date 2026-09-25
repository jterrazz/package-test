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
 * (`<facet>.project.ts`). None of them is a prefix: a
 * kind claiming `src/world/` would claim every module written there next
 * year too, and K7 would be a poster rather than a gate.
 */
export const SIBLINGLESS_KINDS: SiblinglessKind[] = [
    {
        claims: oneOf(
            'src/index.browser.ts',
            'src/facets/api/index.ts',
            'src/facets/cli/index.ts',
            'src/facets/component/index.ts',
            'src/facets/component/index.browser.ts',
            'src/facets/integration/index.ts',
            'src/facets/job/index.ts',
            'src/facets/mobile/index.ts',
            'src/facets/website/index.ts',
            'src/world/stubs/intercept/page-intercept.ts',
            'src/world/stubs/intercept/process-intercept.ts',
        ),
        name: 'composition root or barrel',
        why: 'it wires and re-exports; what it publishes is held by `package-exports.test.ts` and by every spec that imports the entry',
    },
    {
        claims: oneOf(
            'src/facets/mobile/screen/app.port.ts',
            'src/facets/component/render/page.port.ts',
            'src/facets/component/render/options.ts',
            'src/facets/component/render/scenario.ts',
            'src/world/clock/clock.port.ts',
            'src/facets/cli/fixture/fixture.port.ts',
            'src/world/stubs/intercept/intercept.port.ts',
            'src/world/services/seed/seed.port.ts',
            'src/facets/component/viewport/viewport.port.ts',
            'src/kernel/chain/chain.ts',
            'src/kernel/chain/config.ts',
            'src/elements/element.port.ts',
            'src/facets/website/browser/browser.port.ts',
            'src/facets/cli/process/cli.port.ts',
            'src/world/services/containers/container.port.ts',
            'src/world/services/database.port.ts',
            'src/facets/mobile/device/device.port.ts',
            'src/world/services/isolation.port.ts',
            'src/facets/api/server/server.port.ts',
            'src/world/services/service.port.ts',
            'src/world/services/services.ts',
            'src/kernel/config/settings.ts',
            'src/world/stubs/exchange/exchange.ts',
            'lint/config-shape.ts',
        ),
        name: 'type-only declaration',
        why: 'it declares a shape and executes nothing; the compiler is its test, and `type-channel.test-d.ts` holds what the compiler must refuse',
    },
    {
        claims: oneOf(
            'src/kernel/context/with.capability.ts',
            'src/kernel/files/artifacts.ts',
            'src/elements/verbs.ts',
            'src/world/services/containers/service-images.ts',
            'lint/manifest.ts',
            'lint/rule-code.ts',
            'lint/self-layers.ts',
            'lint/self-manifest.ts',
            'lint/self/architecture-rows.ts',
            'lint/siblingless-kinds.ts',
        ),
        name: 'constant data',
        why: 'it is a table, not a behaviour; every reader of it asserts on it (`preset.test.ts` for the artefact paths, `plugin.test.ts` for the manifests, `make lint` for the layer map, which judges every module by it, `siblings.test.ts` for these kinds, `define-facet.test.ts` for the `with()` declaration, `facet-matrix.test.ts` for the rows of the scenario vocabulary)',
    },
    {
        claims: (path) => /^src\/facets\/[a-z]+\/[a-z]+\.project\.ts$/u.test(path),
        name: "a facet's vitest project",
        why: '`projects.test.ts` builds every one of them and asserts the project it produces',
    },
    {
        claims: oneOf(
            'src/facets/component/render/console-recorder.ts',
            'src/facets/component/render/render.action.ts',
        ),
        name: 'a module that runs only in a page',
        why: 'it reads the `document` and `window` of the page it renders in, which node has none of — E5 forbids a simulated one and M3 a stubbed global — so `specs/component/`, run in a real browser under Vitest Browser Mode, is its proof',
    },
    {
        claims: oneOf(
            'src/facets/cli/documents/literate.ts',
            'src/facets/api/api.facet.ts',
            'src/facets/api/api.handle.ts',
            'src/facets/cli/cli.facet.ts',
            'src/facets/cli/cli.handle.ts',
            'src/facets/component/component.facet.ts',
            'src/facets/component/component.handle.ts',
            'src/facets/integration/integration.facet.ts',
            'src/facets/integration/integration.handle.ts',
            'src/facets/job/job.facet.ts',
            'src/facets/job/job.handle.ts',
            'src/facets/mobile/mobile.facet.ts',
            'src/facets/website/website.facet.ts',
        ),
        name: 'a facet module',
        why: 'the facet is proven end to end by its own tree under `specs/<facet>/`, which is what the constructor exists to make possible',
    },
    {
        claims: oneOf(
            'src/expectations/goldens/match-options.ts',
            'src/expectations/text/console.ts',
            'src/expectations/command/container.ts',
            'src/expectations/disk/directory.ts',
            'src/facets/website/fetch/fetch.result.ts',
            'src/expectations/disk/filesystem.ts',
            'src/facets/api/request/http.result.ts',
            'src/facets/job/job.result.ts',
            'src/expectations/text/json.ts',
            'src/facets/website/visit/page.result.ts',
            'src/facets/component/render/render.result.ts',
            'src/facets/component/render/rendered-text.ts',
            'src/expectations/http/response.ts',
            'src/facets/mobile/screen/screen.result.ts',
            'src/expectations/table/table.ts',
            'src/expectations/text/text.ts',
        ),
        name: 'a result accessor',
        why: 'an accessor is what a terminal action hands back: it is exercised by every spec that asserts on a result, and `result.test.ts` holds the base',
    },
    {
        claims: oneOf(
            'src/expectations/command/docker-lookup.ts',
            'src/world/stubs/network/handlers.ts',
            'src/world/stubs/network/msw-node.engine.ts',
            'src/world/stubs/network/server.ts',
            'src/facets/website/browser/clock.engine.ts',
            'src/world/services/postgres/template.ts',
            'src/world/clock/clock.engine.ts',
            'src/facets/component/page/clock.engine.ts',
            'src/facets/component/golden/golden.ts',
            'src/facets/component/page/page.engine.ts',
            'src/facets/component/page/page-runtime.ts',
            'src/facets/component/page/ui.ts',
            'src/facets/component/page/vitest-browser.adapter.ts',
            'src/facets/component/viewport/viewport.engine.ts',
        ),
        name: 'an engine adapter',
        why: 'an engine is proven through the facet that drives it — a probe that could only reach it directly is an integration spec under `specs/integration/services/` (chapter 03)',
    },
    {
        claims: oneOf(
            'lint/catalog-cli.ts',
            'lint/checker-cli.ts',
            'lint/coverage-cli.ts',
            'lint/self-checker-cli.ts',
            'src/facets/api/routes/route-split-cli.ts',
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
            'src/kernel/chain/action.ts',
            'src/kernel/chain/capability.ts',
            'src/kernel/files/ground.ts',
            'src/kernel/chain/state.ts',
            'src/kernel/chain/database-option.ts',
            'src/world/services/startup/registry.ts',
            'src/world/services/startup/start-services.ts',
            'src/kernel/pause.ts',
            'src/vitest/facet-project.ts',
            'src/world/stubs/exchange/stream.ts',
        ),
        name: 'a chain or runner internal',
        why: 'it is reached through the chain, so its proof is the facet specs that drive the chain — a direct test would assert on a seam nothing else speaks to',
    },
];
