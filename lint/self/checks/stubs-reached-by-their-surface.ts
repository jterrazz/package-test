import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Spotted } from '../../engine/checker/registry.js';
import {
    byPosition,
    finding,
    productionReferences,
    targetOf,
} from '../../engine/project/source.js';
import type { SelfPassId } from './checker.js';

const STUBS = 'src/world/stubs/';

const ENTRIES = new Set(['src/index.browser.ts', 'src/index.ts']);

const SURFACE = [
    /^stub\.ts$/u,
    /^exchange\.ts$/u,
    /^kinds\//u,
    /^intercept\/intercept(?:\.capability)?\.ts$/u,
];

const CHANNEL_PICK = /^delivery\/[a-z-]+\/intercept\.ts$/u;

type DeliveryReaders = Readonly<Record<string, readonly string[]>>;

const DELIVERY_READERS: DeliveryReaders = {
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

const LOCK = 'lint/self/checks/stubs-reached-by-their-surface.ts';

type ProductionReference = ReturnType<typeof productionReferences>[number];

function reachable(from: string, inside: string, readers: DeliveryReaders): boolean {
    return (
        SURFACE.some((pattern) => pattern.test(inside)) ||
        (ENTRIES.has(from) && CHANNEL_PICK.test(inside)) ||
        (readers[inside] ?? []).includes(from)
    );
}

function reachesBelowTheSurface(
    references: ProductionReference[],
    readers: DeliveryReaders,
): Spotted<SelfPassId>[] {
    return references.flatMap(({ from, reference }) => {
        const target = targetOf(from, reference.specifier);
        if (!target.startsWith(STUBS) || reachable(from, target.slice(STUBS.length), readers)) {
            return [];
        }
        return [
            finding(
                'stubs-reached-by-their-surface',
                from,
                {
                    fix: `import what the stubs publish — \`stub.ts\`, \`exchange.ts\`, \`kinds/\`, \`intercept/intercept.ts\`, \`intercept/intercept.capability.ts\` — or, for a facet wiring a delivery, declare the edge in \`DELIVERY_READERS\` (\`${LOCK}\`)`,
                    found: `\`${target}\` is reached from outside the stubs, below their surface`,
                },
                reference,
            ),
        ];
    });
}

function edgesNobodyTakes(
    references: ProductionReference[],
    readers: DeliveryReaders,
): Spotted<SelfPassId>[] {
    const taken = new Set(
        references.map(({ from, reference }) => `${from} → ${targetOf(from, reference.specifier)}`),
    );
    return Object.entries(readers).flatMap(([inside, declared]) =>
        declared
            .filter((reader) => !taken.has(`${reader} → ${STUBS}${inside}`))
            .map((reader) =>
                finding('stubs-reached-by-their-surface', LOCK, {
                    fix: `drop \`${reader}\` from the \`${inside}\` row of \`DELIVERY_READERS\`, or restore the import it declares`,
                    found: `\`DELIVERY_READERS\` lets \`${reader}\` reach \`${inside}\`, an edge it no longer takes`,
                }),
            ),
    );
}

export function checkStubsReachedByTheirSurface(
    root: string,
    readers: DeliveryReaders = DELIVERY_READERS,
): Spotted<SelfPassId>[] {
    const references = productionReferences(root).filter(
        ({ from, reference }) => reference.specifier.startsWith('.') && !from.startsWith(STUBS),
    );
    const holdsTheTable = existsSync(resolve(root, LOCK));
    return [
        ...reachesBelowTheSurface(references, readers),
        ...(holdsTheTable ? edgesNobodyTakes(references, readers) : []),
    ].toSorted(byPosition);
}
