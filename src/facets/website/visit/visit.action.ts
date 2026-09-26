import {
    BROWSER_DESCRIPTORS,
    BROWSER_STATES,
    BROWSER_VERBS,
    DRAWN_DESCRIPTORS,
    DRAWN_VERBS,
    WITHIN,
} from '../../../elements/matrix.js';
import { defineAction } from '../../../kernel/chain/action.js';
import type { ChainSignature, MatrixRow } from '../../../kernel/chain/capability.js';
import { headers } from '../../../kernel/context/headers.capability.js';
import { clock } from '../../../world/clock/clock.capability.js';
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
    descriptors: [...DRAWN_DESCRIPTORS, ...BROWSER_DESCRIPTORS, WITHIN, ...BROWSER_STATES],
    name: 'visit',
    perform: async ([path, scenario], read, { browser }, { config, testDir }) => {
        const { backendUrl, baseUrl } = config;
        if (baseUrl === undefined || baseUrl === '') {
            throw new Error('.visit() requires a website under test (use specification.website())');
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
    verbs: [...DRAWN_VERBS, ...BROWSER_VERBS, GOTO],
});
