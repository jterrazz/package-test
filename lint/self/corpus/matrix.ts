import { cell, filesUnder, isGroundFolder, markdownTable } from '@jterrazz/typescript/rules';
import type { Markers } from '@jterrazz/typescript/rules';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { AstNode } from '../../kit/project/ast.js';
import { callShapeOf, callsOf, isCallOf } from '../../kit/project/call-shapes.js';
import { TOKEN_KINDS } from '../../kit/project/tokens.js';
import { COMPOSITIONS, rowsOfCompositions } from './compositions.js';
import {
    FACET_MATRIX_CAPABILITIES,
    FACET_MATRIX_COLUMNS,
    FACET_MATRIX_EXEMPTIONS,
} from './facet-matrix.js';
import type { Capability, CapabilityGroup, Column } from './facet-matrix.js';
import { META_TESTS_LAYER_ROOTS } from './meta-tests.js';

/** A cell counts files, not assertions: an occurrence count moves with every refactor of a loop and says nothing more. */

/** `files` serves the one column with no constructor: component's options are the project's, stated in this repository's `jterrazz.config.ts`. */
const COLUMN_TREES: Record<Column, { extensions: string[]; files?: string[]; roots: string[] }> = {
    api: { extensions: ['.spec.ts', '.spec.yaml', '.specification.ts'], roots: ['specs/api'] },
    cli: { extensions: ['.spec.ts', '.spec.yaml', '.specification.ts'], roots: ['specs/cli'] },
    component: {
        extensions: ['.test.tsx', '.specification.ts'],
        files: ['jterrazz.config.ts'],
        roots: ['specs/component'],
    },
    integration: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/integration'] },
    job: { extensions: ['.spec.ts', '.spec.yaml', '.specification.ts'], roots: ['specs/job'] },
    lint: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/lint'] },
    mobile: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/mobile'] },
    module: { extensions: ['.test.ts', '.test.tsx'], roots: ['src'] },
    website: { extensions: ['.spec.ts', '.specification.ts'], roots: ['specs/website'] },
};

function sourcesUnder(dir: string, extensions: string[]): string[] {
    return filesUnder(dir)
        .filter((path) => !path.split('/').some((segment) => isGroundFolder(segment)))
        .filter((path) => extensions.some((extension) => path.endsWith(extension)))
        .map((path) => join(dir, path));
}

const QUOTES = new Set(['"', "'", '`']);

function pastComment(source: string, index: number): number | undefined {
    const pair = source.slice(index, index + 2);
    if (pair === '//' && source[index - 1] !== ':') {
        const end = source.indexOf('\n', index);
        return end === -1 ? source.length : end;
    }
    if (pair === '/*') {
        const end = source.indexOf('*/', index + 2);
        return end === -1 ? source.length : end + 2;
    }
    return undefined;
}

function pastString(source: string, index: number): number {
    const quote = source[index];
    let at = index + 1;
    while (at < source.length && source[at] !== quote) {
        at += source[at] === '\\' ? 2 : 1;
    }
    return Math.min(at + 1, source.length);
}

/** A sentence about a capability is no exercise of it. Scanned character by character: a regex cannot tell a comment from a string that spells one (`'specs/lint/*' + '/*.spec.yaml'`). */
function withoutComments(source: string): string {
    let out = '';
    let index = 0;
    while (index < source.length) {
        const char = source[index] ?? '';
        const skipped = pastComment(source, index);
        if (skipped !== undefined) {
            index = skipped;
        } else if (QUOTES.has(char)) {
            const end = pastString(source, index);
            out += source.slice(index, end);
            index = end;
        } else {
            out += char;
            index += 1;
        }
    }
    return out;
}

/** A capability named inside a string (a golden's text, a RuleTester case, a message) is not exercised by the file naming it. */
function stringsOf(source: string): boolean[] {
    const inside: boolean[] = [];
    let quote = '';
    for (let index = 0; index < source.length; index += 1) {
        const char = source[index] ?? '';
        if (quote === '') {
            quote = char === '"' || char === "'" || char === '`' ? char : '';
            inside[index] = quote !== '';
        } else {
            inside[index] = true;
            if (char === '\\') {
                index += 1;
                inside[index] = true;
            } else if (char === quote) {
                quote = '';
            }
        }
    }
    return inside;
}

const WRITTEN_IN_CODE = new Set<Capability['group']>([
    'Constructor option',
    'Target',
    'Result accessor',
    'Route option',
    'Setup',
    'Terminal action',
    'Verb',
]);

type Source = {
    calls: AstNode[];
    strings: boolean[];
    text: string;
};

function carries(source: Source, matcher: RegExp, inCode: boolean): boolean {
    if (!inCode) {
        return matcher.test(source.text);
    }
    const global = new RegExp(matcher.source, `${matcher.flags}g`);
    return [...source.text.matchAll(global)].some((match) => source.strings[match.index] !== true);
}

function sourcesOf(root: string): Record<Column, Source[]> {
    const read = (column: Column): Source[] => {
        const tree = COLUMN_TREES[column];
        return [
            ...tree.roots.flatMap((relative) =>
                sourcesUnder(resolve(root, relative), tree.extensions),
            ),
            ...(tree.files ?? []).map((relative) => resolve(root, relative)),
        ].map((path) => {
            const source = readFileSync(path, 'utf8');
            // invariant: a document's only comments are `#` lines, and an apostrophe in its prose is no quote.
            if (path.endsWith('.spec.yaml')) {
                return {
                    calls: [],
                    strings: [],
                    text: source.replaceAll(/^\s*#[^\n]*/gmu, ''),
                };
            }
            const text = withoutComments(source);
            return { calls: callsOf(path, source), strings: stringsOf(text), text };
        });
    };
    // invariant: written out rather than folded: the compiler then holds that every column has a tree.
    return {
        api: read('api'),
        cli: read('cli'),
        component: read('component'),
        integration: read('integration'),
        job: read('job'),
        lint: read('lint'),
        mobile: read('mobile'),
        module: read('module'),
        website: read('website'),
    };
}

export type MatrixRow = {
    capability: Capability;
    cells: Record<Column, null | number>;
};

const TOKENS_ARE_THE_MATCHERS =
    'the matcher owns the family (proven in the module column); a facet uses the ones its goldens need';

const FACET_GROUPS: readonly CapabilityGroup[] = [
    'Constructor option',
    'Setup',
    'Terminal action',
    'Route option',
    'Verb',
    'Target',
    'Result accessor',
];

/** A row two facets state is one row. */
function declaredCapabilities(): Capability[] {
    const rows: Capability[] = [];
    for (const column of FACET_MATRIX_COLUMNS) {
        const composition = column === 'module' ? undefined : COMPOSITIONS[column];
        for (const row of composition === undefined ? [] : rowsOfCompositions(composition)) {
            const at = rows.find(
                (capability) => capability.group === row.group && capability.name === row.name,
            );
            if (at === undefined) {
                const exempt = FACET_MATRIX_EXEMPTIONS[`${row.group} · ${row.name}`];
                rows.push({
                    ...row,
                    columns: [column],
                    ...(exempt === undefined ? {} : { exempt }),
                });
            } else if (at.probe !== row.probe || at.member !== row.member) {
                throw new Error(
                    `${column} states the row ${row.group} · ${row.name} read as ${row.probe}, where another column reads it as ${at.probe}`,
                );
            } else {
                at.columns = [...at.columns, column];
            }
        }
    }
    const facets = rows.toSorted(
        (one, other) => FACET_GROUPS.indexOf(one.group) - FACET_GROUPS.indexOf(other.group),
    );
    return [...facets, ...FACET_MATRIX_CAPABILITIES];
}

export function matrixCapabilities(): Capability[] {
    const tokens: Capability[] = TOKEN_KINDS.map((kind) => ({
        columns: ['api', 'cli', 'integration', 'website', 'module'],
        group: 'Token',
        name: `{{${kind}}}`,
        probe: `{{${kind}`,
        probeByColumn: { module: `match.${kind}` },
        // invariant: a token family is declared by the matcher, not a facet: a family no golden here needs is no hole in that facet, and the module column is the matcher's proof.
        exempt: {
            api: TOKENS_ARE_THE_MATCHERS,
            cli: TOKENS_ARE_THE_MATCHERS,
            integration: TOKENS_ARE_THE_MATCHERS,
            website: TOKENS_ARE_THE_MATCHERS,
        },
    }));
    return [...declaredCapabilities(), ...tokens];
}

/** `.seed()` → `seed`, `toMatch(file())` → `to-match`, `.exitCode` → `exit-code`, `{{uuid}}` → `uuid`. */
export function capabilityFolder(name: string): string {
    return (name.split('(')[0] ?? '')
        .replaceAll(/(?<lower>[a-z0-9])(?<upper>[A-Z])/gu, '$<lower> $<upper>')
        .toLowerCase()
        .split(/[^a-z0-9]+/u)
        .filter((word) => word !== '')
        .join('-');
}

export function matrixCapabilityFolders(column: Column): Set<string> {
    return new Set(
        matrixCapabilities()
            .filter(({ columns }) => columns.includes(column))
            .map(({ name }) => capabilityFolder(name)),
    );
}

const ESCAPE = /[$()*+.?[\\\]^{|}]/gu;

/** Anchored on a word boundary that refuses a leading dot, so `result.json` is not found inside `myresult.json`; a probe opening on a dot is anchored by it. */
function matcherOf(probe: string): RegExp {
    const lead = /^[$A-Z_a-z]/u.test(probe) ? String.raw`(?<![$.\w])` : '';
    return new RegExp(lead + probe.replaceAll(ESCAPE, String.raw`\$&`), 'u');
}

export function matrixRows(root: string): MatrixRow[] {
    const sources = sourcesOf(root);
    const count = (capability: Capability, column: Column): null | number => {
        if (!capability.columns.includes(column)) {
            return null;
        }
        const probe = capability.probeByColumn?.[column] ?? capability.probe;
        const shape = callShapeOf(probe);
        if (shape !== undefined) {
            return sources[column].filter((source) =>
                source.calls.some((call) => isCallOf(call, shape)),
            ).length;
        }
        const matcher = matcherOf(probe);
        const inCode = WRITTEN_IN_CODE.has(capability.group);
        return sources[column].filter((source) => carries(source, matcher, inCode)).length;
    };
    return matrixCapabilities().map((capability) => ({
        capability,
        cells: {
            api: count(capability, 'api'),
            cli: count(capability, 'cli'),
            component: count(capability, 'component'),
            integration: count(capability, 'integration'),
            job: count(capability, 'job'),
            lint: count(capability, 'lint'),
            mobile: count(capability, 'mobile'),
            module: count(capability, 'module'),
            website: count(capability, 'website'),
        },
    }));
}

export const MATRIX_MARKERS: Markers = {
    end: '<!-- /GENERATED:matrix -->',
    start: '<!-- GENERATED:matrix — do not edit by hand; run `npm run docs`. Source: lint/self/corpus/matrix.ts -->',
};

function cellOf(count: null | number): string {
    return count === null ? '—' : String(count);
}

export function exemptions(rows: MatrixRow[]): { column: Column; name: string; why: string }[] {
    const found: { column: Column; name: string; why: string }[] = [];
    for (const row of rows) {
        for (const column of FACET_MATRIX_COLUMNS) {
            const why = row.capability.exempt?.[column];
            if (row.cells[column] === 0 && why !== undefined) {
                found.push({ column, name: row.capability.name, why });
            }
        }
    }
    return found;
}

export function renderMatrixBody(root: string): string {
    const rows = matrixRows(root);
    const groups = [...new Set(rows.map((row) => row.capability.group))];
    const sections = groups.map((group) => {
        const body = markdownTable(
            ['Capability', ...FACET_MATRIX_COLUMNS],
            rows
                .filter((row) => row.capability.group === group)
                .map((row) => {
                    const counts = FACET_MATRIX_COLUMNS.map((column) => cellOf(row.cells[column]));
                    counts.unshift(cell(`\`${row.capability.name}\``));
                    return counts;
                }),
        );
        return `### ${group}\n\n${body}`;
    });
    const byReason = new Map<string, string[]>();
    for (const { column, name, why } of exemptions(rows)) {
        byReason.set(why, [...(byReason.get(why) ?? []), `\`${name}\`·${column}`]);
    }
    const notes = [...byReason].map(([why, cells]) => `- ${why} — ${cells.join(', ')}`);
    const intro =
        'What the framework can do, and how many of this package\u2019s own test FILES exercise it, per facet: a call read from each file\u2019s syntax tree, whatever lines a formatter splits it across, and any other probe read as its literal with comments stripped \u2014 strings too for a key or an accessor \u2014 so a sentence or a string naming a capability never counts as a test of it. A blank (`\u2014`) is a capability the facet does not declare; a `0` is a declared capability nothing here exercises, and every one of them is named under **Exemptions** with the reason it is accepted. `matrix.test.ts` fails on a `0` that is not.';
    return [intro, ...sections, '### Exemptions', notes.join('\n')].join('\n\n');
}

export const MATRIX_LAYERS_MARKERS: Markers = {
    end: '<!-- /GENERATED:layers -->',
    start: '<!-- GENERATED:layers — do not edit by hand; run `npm run docs`. Source: lint/self/corpus/matrix.ts -->',
};

type Layer = { count: number; judges: string; layer: string; where: string };

function countUnder(root: string, roots: string[], extensions: string[]): number {
    return roots.flatMap((relative) => sourcesUnder(resolve(root, relative), extensions)).length;
}

function filesDirectlyIn(dir: string, extensions: string[]): number {
    try {
        return readdirSync(dir, { withFileTypes: true }).filter(
            (entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)),
        ).length;
    } catch {
        return 0;
    }
}

/** Innermost first, the order a reader reads them in. */
export function layers(root: string): Layer[] {
    const allModuleTests = countUnder(root, ['src'], ['.test.ts', '.test.tsx']);
    const ruleTests = countUnder(root, ['lint/consumer/rules'], ['.test.ts']);
    const metaTests = META_TESTS_LAYER_ROOTS.reduce(
        (total, tree) => total + filesDirectlyIn(resolve(root, tree), ['.test.ts']),
        0,
    );
    // invariant: a `*.specification.ts` builds a runner and asserts nothing.
    const facetSpecs = FACET_MATRIX_COLUMNS.filter(
        (column) => column !== 'module' && column !== 'lint',
    ).reduce(
        (total, column) =>
            total +
            countUnder(
                root,
                COLUMN_TREES[column].roots,
                COLUMN_TREES[column].extensions.filter(
                    (extension) => extension !== '.specification.ts',
                ),
            ),
        0,
    );
    const lintSpecs = countUnder(root, ['specs/lint'], ['.spec.ts']);
    return [
        {
            count: allModuleTests,
            judges: 'one module, through its own exports, with nothing started',
            layer: 'Module tests',
            where: '`src/**/*.test.ts` beside the module',
        },
        {
            count: ruleTests,
            judges: 'one rule: what it flags, what it leaves alone, and the message it prints',
            layer: 'Rule tests',
            where: '`lint/consumer/rules/<family>/<rule>.test.ts` beside the rule',
        },
        {
            count: facetSpecs,
            judges: "the framework's own facets, each met through its constructor",
            layer: 'The package’s own specs',
            where: '`specs/<facet>/`',
        },
        {
            count: lintSpecs,
            judges: 'the built plugins, checkers and preset end to end, over fixture trees',
            layer: 'The lint specs',
            where: '`specs/lint/<rule>/`, on the lint facet',
        },
        {
            count: metaTests,
            judges: 'the corpus itself: the catalogue, the matrix, the skill, the floor',
            layer: 'Meta-tests',
            where: META_TESTS_LAYER_ROOTS.map((folder) => `\`${folder}/*.test.ts\``).join(', '),
        },
    ];
}

export function renderMatrixLayers(root: string): string {
    const rows = layers(root).map((layer) => [
        layer.layer,
        cell(layer.where),
        cell(layer.judges),
        String(layer.count),
    ]);
    return markdownTable(['Layer', 'Where', 'What it judges', 'Files'], rows);
}
