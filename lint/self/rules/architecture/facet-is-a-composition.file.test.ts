import { describe, expect, test } from 'vitest';

import { isNode } from '../../../kit/project/ast.js';
import type { AstNode } from '../../../kit/project/ast.js';
import { parseProgram } from '../../../kit/project/module-parser.js';
import { facetFileFindings, importsOf } from './facet-is-a-composition.file.js';

function programOf(source: string): AstNode {
    const program = parseProgram('job.facet.ts', source);
    if (!isNode(program)) {
        throw new Error('the facet file does not parse');
    }
    return program;
}

function findingsOf(source: string): string[] {
    return facetFileFindings(programOf(source)).map((finding) =>
        [finding.messageId, ...Object.values(finding.data ?? {})].join(' '),
    );
}

function facetWiring(adapters: string): string {
    return `
import { seed } from '../../../../services/seed/seed.capability.js';
import { getCallerDir } from '../../../../chain/paths/caller.js';
import { databaseSet } from '../../../../services/seed/database-set.adapter.js';
import { defineFacet } from '../../../define-facet.js';

const composition = {
    actions: [],
    capabilities: [seed],
    options: { root: { group: 'Constructor option', name: 'root', probe: 'root:' } },
} as const;

export const jobFacet = defineFacet()({ ...composition, adapters: ${adapters}, locate: getCallerDir });
`;
}

describe('facet-is-a-composition.file', () => {
    test('facet-file — facetFileFindings — an adapter is a name, a read of the config, or an adapter constructor built on them', () => {
        // Given - the three forms an adapter takes
        const source = facetWiring(
            '(config) => ({ databases: databaseSet(config), jobs: config.jobs ?? [], seed })',
        );

        // Then - none is logic
        expect(findingsOf(source)).toStrictEqual([]);
    });

    test('facet-file — facetFileFindings — an adapter is named by the kind of logic it is written as', () => {
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

    test('facet-file — facetFileFindings — adapters not written as an arrow handing back an object are one finding', () => {
        // Given - adapters computed in a block
        const source = facetWiring('(config) => { return { seed }; }');

        // Then - the adapters, and nothing about what the block holds
        expect(findingsOf(source)).toStrictEqual(['adapters']);
    });

    test('facet-file — importsOf — maps every local name a program imports to its source', () => {
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
