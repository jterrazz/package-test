import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';

import type { TokenViolation } from '../../checks/checker.js';
import { child, childList, isNode, nodeStart, stringValue, walk } from '../../reading/ast.js';
import type { AstNode } from '../../reading/ast.js';
import { parseProgram } from '../../reading/module-parser.js';
import type { LayerOptions } from '../../rules/architecture/import-within-declared-layers.js';
import { ENGINE_OWNERS } from './engines.js';
import { FRAMEWORK_LAYERS } from './layers.js';
import { byPosition, facetOf, finding, inGround, listed } from './source-tree.js';

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

function isProduction(path: string): boolean {
    return (
        /\.tsx?$/u.test(path) && !/\.(?:test|test-d|fixtures)\.tsx?$/u.test(path) && !inGround(path)
    );
}

type Reference = { column: number; line: number; specifier: string };

function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, Math.max(index, 0));
    return { column: index - before.lastIndexOf('\n'), line: before.split('\n').length };
}

function referencesOf(path: string): Reference[] {
    const text = readFileSync(path, 'utf8');
    const program = parseProgram(path, text);
    if (!isNode(program)) {
        return [];
    }
    const found: Reference[] = [];
    const add = (node: AstNode, specifier: string | undefined): void => {
        if (specifier !== undefined) {
            found.push({ ...positionOf(text, nodeStart(node)), specifier });
        }
    };
    for (const statement of childList(program, 'body')) {
        add(statement, stringValue(child(statement, 'source')));
    }
    walk(program, (node) => {
        if (node.type === 'ImportExpression') {
            add(node, stringValue(child(node, 'source')));
        }
    });
    return found;
}

/** Its `.js` read as the `.ts` it is built from. */
function targetOf(from: string, specifier: string): string {
    return posix.normalize(posix.join(posix.dirname(from), specifier)).replace(/\.js$/u, '.ts');
}

function productionReferences(root: string): { from: string; reference: Reference }[] {
    return [...listed(resolve(root, 'src'), 'src'), ...listed(resolve(root, 'lint'), 'lint')]
        .filter(({ directory, path }) => !directory && isProduction(path))
        .flatMap(({ path: from }) =>
            referencesOf(resolve(root, from)).map((reference) => ({ from, reference })),
        );
}

export function checkFacetIsolation(root: string): TokenViolation[] {
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
                        'i10-facet-isolation',
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
                    'i10-facet-isolation',
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

export function checkEngineOwner(root: string): TokenViolation[] {
    return productionReferences(root)
        .flatMap(({ from, reference }) => {
            const { specifier } = reference;
            const engine = Object.keys(ENGINE_OWNERS)
                .filter((name) => specifier === name || specifier.startsWith(`${name}/`))
                .toSorted((one, other) => other.length - one.length)[0];
            const owners = engine === undefined ? [] : (ENGINE_OWNERS[engine] ?? []);
            return engine === undefined || owners.some((owner) => from.startsWith(owner))
                ? []
                : [
                      finding(
                          'i11-engine-owner',
                          from,
                          {
                              fix: `reach the engine through the port \`${owners.join('` or `')}\` implements, handed in by the facet — or import only what the owner exports`,
                              found: `\`${specifier}\` is imported outside \`${owners.join('` and `')}\`, the one slice that owns it`,
                          },
                          reference,
                      ),
                  ];
        })
        .toSorted(byPosition);
}
