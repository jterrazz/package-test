import type { FacetParams, MatrixRow } from '../../kernel/chain/capability.js';
import type { ChainOf } from '../../kernel/chain/chain.js';
import type { ChainConfig } from '../../kernel/chain/config.js';
import { defineFacet } from '../../kernel/chain/define-facet.js';
import { clock } from '../../world/clock/clock.capability.js';
import { mswWorker } from '../../world/stubs/delivery/browser-page/msw-worker.adapter.js';
import { intercept } from '../../world/stubs/intercept/intercept.capability.js';
import type { ComponentOptions } from './component.project.js';
import { pageClock } from './page/clock.driver.js';
import { afterThisTest, pageDirectory } from './page/page-runtime.js';
import { vitestBrowserPage } from './page/page.driver.js';
/* oxlint-disable typescript/consistent-type-definitions, typescript/no-empty-object-type -- the chain is an empty interface over its computed type: the compiler prints an interface by its name, where an alias of a computed type may print expanded */
import { render } from './render/render.action.js';
import { wrap } from './render/wrap.capability.js';
import { viewport } from './viewport/viewport.capability.js';
import { pageViewport } from './viewport/viewport.driver.js';

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
    } satisfies Record<keyof ComponentOptions, MatrixRow>,
} as const;

/** The chain a rendered unit is specified through; the one facet with no constructor, its shared setup the project's. */
export interface ComponentChain extends ChainOf<typeof composition, FacetParams, ComponentChain> {}

export const componentFacet = defineFacet<ComponentChain>()({
    ...composition,
    drivers: (_config: ChainConfig) => ({
        clock: pageClock,
        network: mswWorker(afterThisTest),
        page: vitestBrowserPage,
        viewport: pageViewport,
    }),
    locate: pageDirectory,
});
