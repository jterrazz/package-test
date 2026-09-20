import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { TOKEN_KINDS } from '../core/matching/match.js';
import { cell, table } from './catalog.js';
import { CAPABILITIES, COLUMNS } from './facet-matrix.js';
import type { Capability, Column } from './facet-matrix.js';

/**
 * The capability matrix — what the package proves about itself, per facet.
 *
 * The catalogue answers "which conventions are mechanized"; this answers the
 * other half: for each thing the framework can DO — a constructor option, a
 * setup, a terminal action, a verb, a result accessor, a golden kind, a token
 * family — which facets declare it, and how many of the package's own test
 * files exercise it there. A declared capability with an empty cell is a
 * surface nothing holds, which is the defect class this table exists to make
 * visible: a facet can grow a method and never be specified on it, and no
 * amount of green tests says so.
 *
 * The rows come from three places and are authored in none: the facet
 * declaration (`facet-matrix.ts`), the `{{token}}` list the runner and the
 * checker already share, and — for the count — a static scan of the trees each
 * column owns. `npm run docs` writes the table into `docs/03-testing.md`
 * between markers and into the skill's `references/matrix.md`; `matrix.test.ts`
 * refuses an empty declared cell.
 *
 * A cell counts FILES, not assertions: "three files exercise `.seed()` on api"
 * is a fact a reader can act on, where a raw occurrence count moves with every
 * refactor of a loop and says nothing more.
 */

/** Where each column's test files live, relative to the repository root. */
const COLUMN_TREES: Record<Column, { extensions: string[]; roots: string[] }> = {
    api: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/api'] },
    cli: { extensions: ['.spec.ts', '.spec.yaml', '.specification.ts'], roots: ['specs/cli'] },
    component: { extensions: ['.test.tsx', '.specification.ts'], roots: ['specs/component-app'] },
    integration: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/integration'] },
    jobs: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/jobs'] },
    mobile: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/mobile'] },
    module: { extensions: ['.test.ts', '.test.tsx'], roots: ['src'] },
    website: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/website'] },
};

/** Every file under `dir` whose name ends in one of `extensions`. */
function filesUnder(dir: string, extensions: string[]): string[] {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const found: string[] = [];
    for (const entry of entries) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            found.push(...filesUnder(path, extensions));
        } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
            found.push(path);
        }
    }
    return found;
}

/** The source of every test file a column owns, read once per generation. */
function sourcesOf(root: string): Record<Column, string[]> {
    const read = (column: Column): string[] => {
        const tree = COLUMN_TREES[column];
        return tree.roots
            .flatMap((relative) => filesUnder(resolve(root, relative), tree.extensions))
            .map((path) => readFileSync(path, 'utf8'));
    };
    // Written out rather than folded: the compiler then holds the invariant
    // That every column has a tree, which a `fromEntries` cast would drop.
    return {
        api: read('api'),
        cli: read('cli'),
        component: read('component'),
        integration: read('integration'),
        jobs: read('jobs'),
        mobile: read('mobile'),
        module: read('module'),
        website: read('website'),
    };
}

/** One row of the matrix: a capability, and its count in every column. */
export type MatrixRow = {
    capability: Capability;
    /** `null` where the facet does not declare the capability. */
    cells: Record<Column, null | number>;
};

/** Why a facet may hold no golden of a given token family. */
const TOKENS_ARE_THE_ENGINES =
    'the engine owns the family (proven in the module column); a facet uses the ones its goldens need';

/** Every capability the framework declares, plus one row per `{{token}}` family. */
export function capabilities(): Capability[] {
    const tokens: Capability[] = TOKEN_KINDS.map((kind) => ({
        columns: ['api', 'cli', 'integration', 'website', 'module'],
        group: 'Token',
        name: `{{${kind}}}`,
        probe: `{{${kind}`,
        probeByColumn: { module: `match.${kind}` },
        // A token family is declared by the ENGINE, not by a facet: every
        // Facet that reads a golden can carry any of the twenty-one, and a
        // Family no golden of this package happens to need is not a hole in
        // That facet. The engine's own proof is the module column, which these
        // Rows do not exempt.
        exempt: {
            api: TOKENS_ARE_THE_ENGINES,
            cli: TOKENS_ARE_THE_ENGINES,
            integration: TOKENS_ARE_THE_ENGINES,
            website: TOKENS_ARE_THE_ENGINES,
        },
    }));
    return [...CAPABILITIES, ...tokens];
}

/** The matrix, derived. `root` is the repository root. */
export function matrixRows(root: string): MatrixRow[] {
    const sources = sourcesOf(root);
    const count = (capability: Capability, column: Column): null | number => {
        if (!capability.columns.includes(column)) {
            return null;
        }
        const probe = capability.probeByColumn?.[column] ?? capability.probe;
        return sources[column].filter((source) => source.includes(probe)).length;
    };
    return capabilities().map((capability) => ({
        capability,
        cells: {
            api: count(capability, 'api'),
            cli: count(capability, 'cli'),
            component: count(capability, 'component'),
            integration: count(capability, 'integration'),
            jobs: count(capability, 'jobs'),
            mobile: count(capability, 'mobile'),
            module: count(capability, 'module'),
            website: count(capability, 'website'),
        },
    }));
}

/** Markers delimiting the generated matrix inside `docs/03-testing.md`. */
export const MATRIX_START =
    '<!-- GENERATED:matrix — do not edit by hand; run `npm run docs`. Source: src/lint/matrix.ts -->';
export const MATRIX_END = '<!-- /GENERATED:matrix -->';

/** First-line header stamped on the generated skill reference `matrix.md`. */
export const MATRIX_HEADER = "<!-- GENERATED by 'npm run docs' — DO NOT EDIT -->";

/** A cell: the count, or an em dash where the facet does not declare it. */
function cellOf(count: null | number): string {
    return count === null ? '—' : String(count);
}

/** Every declared-but-empty cell, with the reason its row states for it. */
export function exemptions(rows: MatrixRow[]): { column: Column; name: string; why: string }[] {
    const found: { column: Column; name: string; why: string }[] = [];
    for (const row of rows) {
        for (const column of COLUMNS) {
            const why = row.capability.exempt?.[column];
            if (row.cells[column] === 0 && why !== undefined) {
                found.push({ column, name: row.capability.name, why });
            }
        }
    }
    return found;
}

/** The matrix as markdown: one section per group, then the exemptions. */
export function renderMatrixBody(root: string): string {
    const rows = matrixRows(root);
    const groups = [...new Set(rows.map((row) => row.capability.group))];
    const sections = groups.map((group) => {
        const body = table(
            ['Capability', ...COLUMNS],
            rows
                .filter((row) => row.capability.group === group)
                .map((row) => {
                    const counts = COLUMNS.map((column) => cellOf(row.cells[column]));
                    counts.unshift(cell(`\`${row.capability.name}\``));
                    return counts;
                }),
        ).join('\n');
        return `### ${group}\n\n${body}`;
    });
    const notes = exemptions(rows).map(
        ({ column, name, why }) => `- \`${name}\` · **${column}** — ${why}`,
    );
    const intro =
        'What the framework can do, and how many of this package\u2019s own test files exercise it, per facet. A blank (`—`) is a capability the facet does not declare; a `0` is a declared capability nothing here exercises, and every one of them is named under **Exemptions** with the reason it is accepted. `matrix.test.ts` fails on a `0` that is not.';
    return [intro, ...sections, '### Exemptions', notes.join('\n')].join('\n\n');
}

/** The matrix spliced into `docs/03-testing.md` between the GENERATED markers. */
export function spliceMatrix(existing: string, root: string): string {
    const start = existing.indexOf(MATRIX_START);
    const end = existing.indexOf(MATRIX_END);
    if (start === -1 || end === -1) {
        throw new Error(
            `docs/03-testing.md is missing the GENERATED:matrix markers (${MATRIX_START} … ${MATRIX_END})`,
        );
    }
    const inner = `${MATRIX_START}\n\n${renderMatrixBody(root)}\n\n`;
    return existing.slice(0, start) + inner + existing.slice(end);
}

/** The agent-facing projection, `skills/jterrazz-test/references/matrix.md`. */
export function renderMatrix(root: string): string {
    return `${[
        MATRIX_HEADER,
        '# `@jterrazz/test` — capability matrix',
        renderMatrixBody(root),
    ].join('\n\n')}\n`;
}
