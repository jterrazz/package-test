import type { Finding } from '../../engine/checker/finding.js';
import {
    byPosition,
    finding,
    productionReferences,
    targetOf,
} from '../../engine/project/source.js';
import type { SelfPassId } from './checker.js';

const STUBS = 'src/world/stubs/';

const ENTRIES = new Set(['src/index.browser.ts', 'src/index.ts']);

const SURFACE = [/^stub\.ts$/u, /^exchange\.ts$/u, /^kinds\//u, /^intercept\//u];

const CHANNEL_PICK = /^delivery\/[a-z-]+\/intercept\.ts$/u;

export const DELIVERY_READERS: Readonly<Record<string, readonly string[]>> = {
    'delivery/browser-page/msw-worker.adapter.ts': ['src/facets/component/component.facet.ts'],
    'delivery/browser-page/worker-script.ts': ['src/facets/component/component.project.ts'],
    'delivery/other-process/stub-backend.adapter.ts': [
        'src/facets/mobile/mobile.facet.ts',
        'src/facets/website/website.facet.ts',
    ],
    'delivery/other-process/stub-backend.ts': [
        'src/facets/mobile/mobile.handle.ts',
        'src/facets/website/website.handle.ts',
    ],
    'delivery/same-process/msw-node.adapter.ts': [
        'src/facets/api/api.facet.ts',
        'src/facets/integration/integration.facet.ts',
        'src/facets/job/job.facet.ts',
    ],
};

function reachable(from: string, inside: string): boolean {
    return (
        SURFACE.some((pattern) => pattern.test(inside)) ||
        (ENTRIES.has(from) && CHANNEL_PICK.test(inside)) ||
        (DELIVERY_READERS[inside] ?? []).includes(from)
    );
}

export function checkStubsReachedByTheirSurface(root: string): Finding<SelfPassId>[] {
    return productionReferences(root)
        .filter(
            ({ from, reference }) => reference.specifier.startsWith('.') && !from.startsWith(STUBS),
        )
        .flatMap(({ from, reference }) => {
            const target = targetOf(from, reference.specifier);
            if (!target.startsWith(STUBS) || reachable(from, target.slice(STUBS.length))) {
                return [];
            }
            return [
                finding(
                    'stubs-reached-by-their-surface',
                    from,
                    {
                        fix: `import what the stubs publish — \`stub.ts\`, \`exchange.ts\`, \`kinds/\`, \`intercept/\` — or, for a facet wiring a delivery, declare the edge in \`DELIVERY_READERS\` (\`lint/self/checks/stubs-reached-by-their-surface.ts\`)`,
                        found: `\`${target}\` is reached from outside the stubs, below their surface`,
                    },
                    reference,
                ),
            ];
        })
        .toSorted(byPosition);
}
