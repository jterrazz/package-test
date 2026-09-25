import { describe, expect, test } from 'vitest';

import { parseProgram } from '../src/seams/oxc-parser/parse.js';
import { isNode } from './ast.js';
import { handleFileFindings } from './facet-handle.js';

/** What each finding of a constructor says, as `<messageId> <data values>`. */
function findingsOf(body: string): string[] {
    const program = parseProgram(
        'jobs.handle.ts',
        `import { seed } from '../../capabilities/seed/seed.capability.js';\nimport * as results from '../../results/result.js';\nimport { jobsFacet } from './jobs.facet.js';\n${body}`,
    );
    if (!isNode(program)) {
        throw new Error('the constructor does not parse');
    }
    return handleFileFindings(program).map((finding) =>
        [finding.messageId, ...Object.values(finding.data)].join(' '),
    );
}

describe('handleFileFindings', () => {
    test('a step is named by what it is read off, however that is reached', () => {
        // Given - a step read off an alias of the definition, off the facet, and one bound to a name before its binding
        const source = [
            'const run = () => late([]);',
            'const definition = seed;',
            "definition['perform']([]);",
            'jobsFacet.composition.capabilities.reduce([]);',
            'const { arm: late } = seed;',
        ].join('\n');

        // Then - each names the owner it is read off and the step it runs
        expect(findingsOf(source)).toStrictEqual([
            'runsStep seed arm',
            'runsStep definition perform',
            'runsStep jobsFacet.composition.capabilities reduce',
        ]);
    });

    test('opening the facet, an array of its own, and a result read by name build and run nothing', () => {
        // Given - what a constructor does: open the facet, fold its rows, name a result's type
        const source = [
            'const rows = [1, 2].reduce((sum, value) => sum + value, 0);',
            'const kind = results.BaseResult.name;',
            'export const jobs = jobsFacet.open({ kind, rows });',
            'const built = new results.BaseResult({});',
        ].join('\n');

        // Then - only the result built with `new` is a finding
        expect(findingsOf(source)).toStrictEqual(['buildsResult results.BaseResult']);
    });
});
