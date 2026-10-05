import { defineAction } from '../../../chain/action.js';
import type { ChainSignature, MatrixRow } from '../../../chain/capability.js';
import { headers } from '../../../chain/context/headers.capability.js';
import { invariant } from '../../../chain/refusals/refusal.js';
import { clock } from '../../../clock/clock.capability.js';
import {
    BROWSER_STATES,
    BROWSER_TARGETS,
    BROWSER_VERBS,
    EVERY_SURFACE_TARGETS,
    EVERY_SURFACE_VERBS,
    WITHIN,
} from '../../../visitor/matrix.js';
import type { BrowserPort, VisitScenario } from '../browser/browser.port.js';
import type { WebsiteConfig } from '../website.handle.js';
import { PageResult } from './page.result.js';

const GOTO: MatrixRow = { group: 'Verb', name: 'goto', probe: '.goto(' };

type Needs = { browser: () => Promise<BrowserPort> };

export type VisitSignature = ChainSignature & {
    readonly chain: {
        /** Render the page in the shared browser and resolve with the final captured document. */
        visit: (path: string, scenario?: VisitScenario) => Promise<PageResult>;
    };
};

export const visit = defineAction<
    'visit',
    [path: string, scenario?: VisitScenario],
    PageResult,
    VisitSignature,
    Needs,
    WebsiteConfig
>({
    accessors: [
        { group: 'Result accessor', name: '.status', probe: 'result.status' },
        { group: 'Result accessor', name: '.tree', probe: 'result.tree' },
        { group: 'Result accessor', name: '.content', probe: 'result.content' },
        { group: 'Result accessor', name: '.console', probe: 'result.console' },
        { group: 'Result accessor', name: '.errors', probe: 'result.errors' },
        { group: 'Result accessor', name: '.html', probe: 'result.html' },
        { group: 'Result accessor', name: '.title', probe: 'result.title' },
        { group: 'Result accessor', name: '.url', probe: 'result.url' },
        { group: 'Result accessor', name: '.head', probe: 'result.head' },
        { group: 'Result accessor', name: '.jsonLd', probe: 'result.jsonLd' },
        { group: 'Result accessor', name: '.canonical', probe: 'result.canonical' },
        { group: 'Result accessor', name: '.alternates', probe: 'result.alternates' },
        { group: 'Result accessor', name: '.links', probe: 'result.links' },
        { group: 'Result accessor', member: 'meta', name: '.meta()', probe: 'result.meta' },
    ],
    targets: [...EVERY_SURFACE_TARGETS, ...BROWSER_TARGETS, WITHIN, ...BROWSER_STATES],
    name: 'visit',
    perform: async ([path, scenario], read, { browser }, { config, testDir }) => {
        const { backendUrl, baseUrl } = config;
        if (baseUrl === undefined || baseUrl === '') {
            throw invariant('.visit() reached a chain with no website under test');
        }
        const carried = read(headers);
        const pinned = read(clock);
        const opened = await browser();
        const page = await opened.open(`${baseUrl}${path}`, {
            allowedOrigins: backendUrl === undefined ? undefined : [new URL(backendUrl).origin],
            baseUrl,
            ...(pinned === null ? {} : { clock: pinned }),
            external: config.external ?? 'allow',
            headers: Object.keys(carried).length > 0 ? carried : undefined,
            scenario,
        });
        return new PageResult({ config, page, testDir });
    },
    row: { group: 'Terminal action', name: '.visit()', probe: ".visit('" },
    verbs: [...EVERY_SURFACE_VERBS, ...BROWSER_VERBS, GOTO],
});
