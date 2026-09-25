import { clock } from '../../capabilities/clock/clock.capability.js';
import { headers } from '../../capabilities/headers/headers.capability.js';
import { defineAction } from '../../model/chain/action.js';
import type { BrowserPort, VisitScenario } from '../../model/ports/browser.port.js';
import { PageResult } from '../../results/page.result.js';

/** The worker's one browser, launched on the first visit that asks for it. */
type Needs = { browser: () => Promise<BrowserPort> };

/**
 * `.visit(path, scenario)`: render the page in the shared browser and resolve
 * with the captured document — the FINAL state when a scenario ran. The
 * chain's headers ride every request of the visit, and its clock is the
 * page's own calendar.
 */
export const visit = defineAction<
    'visit',
    [path: string, scenario?: VisitScenario],
    PageResult,
    Needs
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
});
