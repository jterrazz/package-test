import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';

import { child, childList, isNode, nodeStart, stringValue, walk } from './ast.js';
import { byPosition, facetOf, finding, inGround, listed } from './checker-source-tree.js';
import type { TokenViolation } from './checker.js';
import { parseProgram } from './module-parser.js';
import type { AstNode } from './rule-shape.js';

/**
 * What the modules of this package's `src/` and `lint/` import — the self
 * checker passes I10 and I11: a facet reached from outside it, and an engine
 * imported outside the one slice that owns it. Each finding sits at the
 * import that names it.
 */

/**
 * The modules reached inside a facet from outside it, each for its reason: the
 * one vite plugin a facet owns (the cli's literate door, which the preset
 * wires), and the two modules the checker reads with the runner (the route
 * ratchet's key, the `.spec.yaml` grammar).
 */
const REACHED_INSIDE_A_FACET = new Set([
    'src/facets/api/routes/baseline.ts',
    'src/facets/cli/documents/literate-plugin.ts',
    'src/facets/cli/documents/spec-document.ts',
]);

/**
 * The one slice each third-party engine is imported from, by the specifier's
 * prefix: a path prefix, or one exact module. `world/services/peer.ts` loads
 * the optional peers by name for their owners, and carries none of its own.
 */
export const ENGINE_OWNERS: Readonly<Record<string, readonly string[]>> = {
    '@hono/node-server': ['src/facets/api/'],
    '@vitest/browser-playwright': ['src/facets/component/', 'src/vitest/'],
    'better-sqlite3': ['src/world/services/sqlite/'],
    hono: ['src/facets/api/'],
    msw: ['src/world/stubs/network/'],
    'oxc-parser': ['lint/module-parser.ts'],
    pg: ['src/world/services/postgres/'],
    playwright: ['src/facets/website/'],
    react: ['src/facets/component/'],
    'react-dom': ['src/facets/component/'],
    redis: ['src/world/services/redis/'],
    testcontainers: ['src/world/services/containers/'],
    'vitest-browser-react': ['src/facets/component/'],
    'vitest-mock-extended': ['src/world/mocks/'],
    'vitest/browser': ['src/facets/component/'],
    webdriverio: ['src/facets/mobile/'],
    yaml: ['src/kernel/files/yaml-document.ts'],
};

/** Is the path a module the code runs — no test, no type test, no fixture module, no ground? */
function isProduction(path: string): boolean {
    return (
        /\.tsx?$/u.test(path) && !/\.(?:test|test-d|fixtures)\.tsx?$/u.test(path) && !inGround(path)
    );
}

/** A module a production module names, and where it names it. */
type Reference = { column: number; line: number; specifier: string };

/** The 1-based line and column of an offset. */
function positionOf(text: string, index: number): { column: number; line: number } {
    const before = text.slice(0, Math.max(index, 0));
    return { column: index - before.lastIndexOf('\n'), line: before.split('\n').length };
}

/** Every specifier a module names: its imports and re-exports (types included) and each `import('…')`, each at its statement. */
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

/** The repository path a relative specifier of `from` names, its `.js` read as the `.ts` it is built from. */
function targetOf(from: string, specifier: string): string {
    return posix.normalize(posix.join(posix.dirname(from), specifier)).replace(/\.js$/u, '.ts');
}

/** The production modules of the two trees that hold code, `src/` and `lint/`, each with what it names. */
function productionReferences(root: string): { from: string; reference: Reference }[] {
    return [...listed(resolve(root, 'src'), 'src'), ...listed(resolve(root, 'lint'), 'lint')]
        .filter(({ directory, path }) => !directory && isProduction(path))
        .flatMap(({ path: from }) =>
            referencesOf(resolve(root, from)).map((reference) => ({ from, reference })),
        );
}

/**
 * I10 — every import of a production module that crosses into a facet it is
 * not in, at the import: a facet importing another, or anything outside a
 * facet reaching below the facet's root files, but for the modules reached
 * for their reason.
 */
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
            const rootFile = target.split('/').length === 4;
            return rootFile || REACHED_INSIDE_A_FACET.has(target)
                ? []
                : [
                      finding(
                          'i10-facet-isolation',
                          from,
                          {
                              fix: `import it from the facet's face — export it from \`src/facets/${into}/index.ts\` — or move it below the facets`,
                              found: `\`${target}\` is reached inside the facet \`${into}\`, below its root files`,
                          },
                          reference,
                      ),
                  ];
        })
        .toSorted(byPosition);
}

/** I11 — every engine a production module imports from outside the one slice that owns it, at the import. */
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
