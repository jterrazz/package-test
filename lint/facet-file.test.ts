import { describe, expect, test } from 'vitest';

import { isNode } from './ast.js';
import { facetFileFindings, importsOf } from './facet-file.js';
import { parseProgram } from './module-parser.js';
import type { AstNode } from './rule-shape.js';

/** The program a facet file's source parses to. */
function programOf(source: string): AstNode {
    const program = parseProgram('job.facet.ts', source);
    if (!isNode(program)) {
        throw new Error('the facet file does not parse');
    }
    return program;
}

/** What each finding says, as `<messageId> <data values>`. */
function findingsOf(source: string): string[] {
    return facetFileFindings(programOf(source)).map((finding) =>
        [finding.messageId, ...Object.values(finding.data ?? {})].join(' '),
    );
}

/** A facet whose adapters are written with `engines`. */
function facetWiring(engines: string): string {
    return `
import { seed } from '../../world/services/seed/seed.capability.js';
import { getCallerDir } from '../../kernel/files/caller.js';
import { databaseSet } from '../../world/services/seed/database-set.engine.js';
import { defineFacet } from '../define-facet.js';

const composition = {
    actions: [],
    capabilities: [seed],
    options: { root: { group: 'Constructor option', name: 'root', probe: 'root:' } },
} as const;

export const jobFacet = defineFacet()({ ...composition, engines: ${engines}, locate: getCallerDir });
`;
}

describe('facet-file', () => {
    test('facetFileFindings — an adapter is a name, a read of the config, or an engine built on them', () => {
        // Given - the three forms an adapter takes
        const source = facetWiring(
            '(config) => ({ databases: databaseSet(config), jobs: config.jobs ?? [], seed })',
        );

        // Then - none is logic
        expect(findingsOf(source)).toStrictEqual([]);
    });

    test('facetFileFindings — an adapter is named by the kind of logic it is written as', () => {
        // Given - an arrow, an object holding one, a definition built on, and an unknown call
        const source = facetWiring(
            '(config) => ({ at: () => 0, clock: { pin: () => 0 }, seeded: seed.build(config), sorted: [].toSorted() })',
        );

        // Then - each is found, its kind named
        expect(findingsOf(source)).toStrictEqual([
            'adapter at arrow function expression',
            'adapter clock object expression',
            'adapter seeded call expression',
            'adapter sorted call expression',
        ]);
    });

    test('facetFileFindings — engines not written as an arrow handing back an object are one finding', () => {
        // Given - engines computed in a block
        const source = facetWiring('(config) => { return { seed }; }');

        // Then - the engines, and nothing about what the block holds
        expect(findingsOf(source)).toStrictEqual(['engines']);
    });

    test('importsOf — maps every local name a program imports to its source', () => {
        // Given - a named, a renamed, a default and a namespace import
        const source =
            "import { a, b as c } from './one.js';\nimport d from './two.js';\nimport * as e from './three.js';\nexport const f = a;\n";

        // Then - each local name, with its source
        expect([...importsOf(programOf(source))]).toStrictEqual([
            ['a', './one.js'],
            ['c', './one.js'],
            ['d', './two.js'],
            ['e', './three.js'],
        ]);
    });
});
