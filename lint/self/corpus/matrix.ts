import { cell, markdownTable } from '@jterrazz/typescript/rules';
import type { Markers } from '@jterrazz/typescript/rules';

import { callShapeOf, isCallOf } from '../../kit/project/call-shapes.js';
import { TOKEN_KINDS } from '../../kit/project/tokens.js';
import { COMPOSITIONS, rowsOfCompositions } from './compositions.js';
import { matrixSources } from './matrix-sources.js';
import type { Source } from './matrix-sources.js';
import {
    SPECIFICATION_MATRIX_CAPABILITIES,
    SPECIFICATION_MATRIX_COLUMNS,
    SPECIFICATION_MATRIX_EXEMPTIONS,
} from './specification-matrix.js';
import type { Capability, CapabilityGroup, Column } from './specification-matrix.js';

// invariant: a cell counts files, not assertions: an occurrence count moves with every refactor of a loop and says nothing more.

const WRITTEN_IN_CODE = new Set<Capability['group']>([
    'Constructor option',
    'Target',
    'Result accessor',
    'Route option',
    'Setup',
    'Terminal action',
    'Verb',
]);

export function carries(source: Source, matcher: RegExp, inCode: boolean): boolean {
    if (!inCode) {
        return matcher.test(source.text);
    }
    const global = new RegExp(matcher.source, `${matcher.flags}g`);
    return [...source.text.matchAll(global)].some((match) => source.strings[match.index] !== true);
}

export type MatrixRow = {
    capability: Capability;
    cells: Record<Column, null | number>;
};

const TOKENS_ARE_THE_MATCHERS =
    'the matcher owns the family (proven in the module column); a specification uses the ones its goldens need';

const SPECIFICATION_GROUPS: readonly CapabilityGroup[] = [
    'Constructor option',
    'Setup',
    'Terminal action',
    'Route option',
    'Verb',
    'Target',
    'Result accessor',
];

// invariant: a row two specifications state is one row.
function declaredCapabilities(): Capability[] {
    const rows: Capability[] = [];
    for (const column of SPECIFICATION_MATRIX_COLUMNS) {
        const composition = column === 'module' ? undefined : COMPOSITIONS[column];
        for (const row of composition === undefined ? [] : rowsOfCompositions(composition)) {
            const at = rows.find(
                (capability) => capability.group === row.group && capability.name === row.name,
            );
            if (at === undefined) {
                const exempt = SPECIFICATION_MATRIX_EXEMPTIONS[`${row.group} · ${row.name}`];
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
    const specifications = rows.toSorted(
        (one, other) =>
            SPECIFICATION_GROUPS.indexOf(one.group) - SPECIFICATION_GROUPS.indexOf(other.group),
    );
    return [...specifications, ...SPECIFICATION_MATRIX_CAPABILITIES];
}

export function matrixCapabilities(): Capability[] {
    const tokens: Capability[] = TOKEN_KINDS.map((kind) => ({
        columns: ['api', 'cli', 'integration', 'website', 'deployment', 'module'],
        group: 'Token',
        name: `{{${kind}}}`,
        probe: `{{${kind}`,
        probeByColumn: { module: `match.${kind}` },
        // invariant: a token family is declared by the matcher, not a specification: a family no golden here needs is no hole in that specification, and the module column is the matcher's proof.
        exempt: {
            api: TOKENS_ARE_THE_MATCHERS,
            cli: TOKENS_ARE_THE_MATCHERS,
            integration: TOKENS_ARE_THE_MATCHERS,
            website: TOKENS_ARE_THE_MATCHERS,
            deployment: TOKENS_ARE_THE_MATCHERS,
        },
    }));
    return [...declaredCapabilities(), ...tokens];
}

/** `.seed()` gives `seed`, `toMatch(file())` gives `to-match`, `.exitCode` gives `exit-code`, `{{uuid}}` gives `uuid`. */
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

// invariant: anchored on a word boundary that refuses a leading dot, so `result.json` is not found inside `myresult.json`; a probe opening on a dot is anchored by it.
function matcherOf(probe: string): RegExp {
    const lead = /^[$A-Z_a-z]/u.test(probe) ? String.raw`(?<![$.\w])` : '';
    return new RegExp(lead + probe.replaceAll(ESCAPE, String.raw`\$&`), 'u');
}

export function matrixRows(root: string): MatrixRow[] {
    const sources = matrixSources(root);
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
            deployment: count(capability, 'deployment'),
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
    start: '<!-- GENERATED:matrix. Do not edit by hand; run `npm run docs`. Source: lint/self/corpus/matrix.ts -->',
};

function cellOf(count: null | number): string {
    return count === null ? 'n/a' : String(count);
}

function exemptions(rows: MatrixRow[]): { column: Column; name: string; why: string }[] {
    const found: { column: Column; name: string; why: string }[] = [];
    for (const row of rows) {
        for (const column of SPECIFICATION_MATRIX_COLUMNS) {
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
            ['Capability', ...SPECIFICATION_MATRIX_COLUMNS],
            rows
                .filter((row) => row.capability.group === group)
                .map((row) => {
                    const counts = SPECIFICATION_MATRIX_COLUMNS.map((column) =>
                        cellOf(row.cells[column]),
                    );
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
    const notes = [...byReason].map(([why, cells]) => `- ${why}: ${cells.join(', ')}`);
    const intro =
        "What the framework can do, and how many of this package's own test FILES exercise it, per specification: a call read from each file's syntax tree, whatever lines a formatter splits it across, and any other probe read as its literal with comments stripped (strings too, for a key or an accessor), so a sentence or a string naming a capability never counts as a test of it. A cell reading `n/a` is a capability the specification does not declare; a `0` is a declared capability nothing here exercises, and every one of them is named under **Exemptions** with the reason it is accepted. `matrix.test.ts` fails on a `0` that is not.";
    return [intro, ...sections, '### Exemptions', notes.join('\n')].join('\n\n');
}
