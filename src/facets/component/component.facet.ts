import type { FacetParams, MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { SpecificationConfig } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import type { FacetProjectOptions } from '../../vitest/facet-project.js';
import { clock } from '../../world/clock/clock.capability.js';
import { intercept } from '../../world/stubs/intercept/intercept.capability.js';
import { mswWorker } from '../../world/stubs/interceptor/worker.js';
import type { ComponentProjectOptions } from './component.project.js';
import { pageClock } from './page/clock.engine.js';
import { afterThisTest, pageDirectory } from './page/page-runtime.js';
import { vitestBrowserPage } from './page/page.engine.js';
import { wrap } from './page/wrap.capability.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { render } from './render/render.action.js';
import { viewport } from './viewport/viewport.capability.js';
import { pageViewport } from './viewport/viewport.engine.js';

const composition = {
    actions: [render],
    capabilities: [clock, intercept, viewport, wrap],
    options: {
        clock: { group: 'Constructor option', name: 'clock', probe: 'clock:' },
        locale: { group: 'Constructor option', name: 'locale', probe: 'locale:' },
        root: { group: 'Constructor option', name: 'root', probe: 'root:' },
        timezone: { group: 'Constructor option', name: 'timezone', probe: 'timezone:' },
        viewport: { group: 'Constructor option', name: 'viewport', probe: 'viewport:' },
        vite: { group: 'Constructor option', name: 'vite', probe: 'vite:' },
        wrap: { group: 'Constructor option', name: 'wrap', probe: 'wrap:' },
    } satisfies Record<
        Exclude<keyof ComponentProjectOptions, keyof FacetProjectOptions>,
        MatrixRow
    >,
} as const;

/**
 * `component` — the chain a rendered unit is specified through. Every setup
 * returns a new chain, so the handle a spec imports never carries the
 * previous test's stubs, wrapper or clock.
 *
 * It is the one facet with no constructor. A component is a UNIT, like a
 * module: there is no server to start, no database to isolate, no binary to
 * find, so there is nothing for a `*.specification.ts` to hold. What such a
 * file WOULD have held — the providers every render needs, the Vite pipeline,
 * the clock, the viewport — belongs to the PROJECT (`component()` in
 * `vitest.config.ts`); what belongs to one test is said on the chain.
 *
 * ```tsx
 * const result = await component
 *     .intercept(listing)
 *     .render(<PostTable />, async (visitor) => {
 *         await visitor.see(content('Showing 2 of 200 posts'));
 *     });
 *
 * await expect(result.tree).toMatch(file('./expected/two-of-two-hundred.aria.yaml'));
 * ```
 */
export interface ComponentChain extends ChainOf<typeof composition, FacetParams, ComponentChain> {}

/**
 * The composition in a page: the page's calendar, msw's worker, the mounted
 * document and its size, and the page's directory, which is none.
 */
export const componentFacet = defineFacet<ComponentChain>()({
    ...composition,
    engines: (_config: SpecificationConfig) => ({
        clock: pageClock,
        network: mswWorker(afterThisTest),
        page: vitestBrowserPage,
        viewport: pageViewport,
    }),
    locate: pageDirectory,
});
