import type { LayerOptions } from '../../consumer/rules/architecture/import-within-declared-layers.js';
import type { Finding } from '../../engine/checker/finding.js';
import {
    byPosition,
    facetOf,
    finding,
    productionReferences,
    targetOf,
} from '../../engine/project/source.js';
import type { SelfPassId } from './checker.js';
import { FRAMEWORK_LAYERS } from './layers.js';

function treeOf(layer: string): string {
    return layer === 'lint' ? 'lint/' : `src/${layer}/`;
}

function fileOf(path: string): string {
    const file = path.endsWith('.ts') ? path : `${path}.ts`;
    return file.startsWith('lint/') ? file : `src/${file}`;
}

function facetEdges(): { path: string; reader: string }[] {
    const edges: { path: string; reader: string }[] = [];
    for (const [layer, options] of Object.entries<LayerOptions>(FRAMEWORK_LAYERS)) {
        for (const path of options.imports ?? []) {
            edges.push({ path, reader: treeOf(layer) });
        }
        for (const [module, paths] of Object.entries(options.seams ?? {})) {
            edges.push(...paths.map((path) => ({ path, reader: fileOf(module) })));
        }
    }
    return edges.filter(({ path }) => path.startsWith('facets/'));
}

/** The face (`index.ts`, `index.browser.ts`) serves anyone; each other root file has the one reader the layer map grants it. */
function entersByTheFace(from: string, facet: string, name: string): boolean {
    if (name === 'index.ts' || name === 'index.browser.ts') {
        return true;
    }
    const target = `facets/${facet}/${name.replace(/\.ts$/u, '')}`;
    return facetEdges().some(
        ({ path, reader }) =>
            from.startsWith(reader) &&
            (path === target || (path === 'facets/' && name === `${facet}.facet.ts`)),
    );
}

function reachedInside(from: string, target: string): boolean {
    return facetEdges().some(
        ({ path, reader }) => fileOf(path) === target && from.startsWith(reader),
    );
}

export function checkNoCrossFacetImport(root: string): Finding<SelfPassId>[] {
    return productionReferences(root)
        .filter(({ reference }) => reference.specifier.startsWith('.'))
        .flatMap(({ from, reference }) => {
            const target = targetOf(from, reference.specifier);
            const into = facetOf(target);
            const own = facetOf(from);
            if (into === undefined || into === own) {
                return [];
            }
            if (own !== undefined) {
                return [
                    finding(
                        'no-cross-facet-import',
                        from,
                        {
                            fix: 'move what the two facets share below the facets — to `kernel/`, `world/`, `elements/` or `expectations/` — and import it from there',
                            found: `the facet \`${own}\` imports \`${target}\`, a module of the facet \`${into}\``,
                        },
                        reference,
                    ),
                ];
            }
            const segments = target.split('/');
            const name = segments.at(-1);
            const rootFile = segments.length === 4;
            if (rootFile && name !== undefined && entersByTheFace(from, into, name)) {
                return [];
            }
            if (!rootFile && reachedInside(from, target)) {
                return [];
            }
            return [
                finding(
                    'no-cross-facet-import',
                    from,
                    rootFile
                        ? {
                              fix: `import it from the facet's face — export it from \`src/facets/${into}/index.ts\``,
                              found: `\`${target}\` is reached from outside the facet \`${into}\` by a module its face does not serve`,
                          }
                        : {
                              fix: `import it from the facet's face — export it from \`src/facets/${into}/index.ts\` — or move it below the facets`,
                              found: `\`${target}\` is reached inside the facet \`${into}\`, below its root files`,
                          },
                    reference,
                ),
            ];
        })
        .toSorted(byPosition);
}
