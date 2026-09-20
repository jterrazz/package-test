import { describe, expect, test } from 'vitest';

import { cli } from '../lint.specification.js';

/**
 * K4 — the REACH of a rule, proven on one project laid out with every path
 * role, from a SINGLE oxlint run.
 *
 * A reach the catalogue states and nothing checks is a sentence. The fixture
 * puts the same three violations (a sleep, an environment assignment, a DOM
 * global) in front of every role a file can have — a module test and a
 * component test beside their code, a facet spec under `specs/api/`, a
 * repository suite under `specs/build/`, the facet's specification, and the
 * config — and each assertion below reads what the run said about ONE path.
 *
 * One run, because that is what makes the assertions comparable: the same
 * plugin, the same options, the same tree. The project's own budget is the
 * unit project's, stated in chapter 03.
 */
/** The one run every assertion below reads. */
async function reachRun(): Promise<string> {
    const result = await cli
        .env({ LINT_CONFIG: 'oxlint.reach.json' })
        .fixture('lint-reach/')
        .exec('.');
    return result.stdout.text;
}

/**
 * What the run said about one path — read off the `unix` rendering the
 * wrapper pins (`<path>:<line>:<col>: <message> [<Severity>/<rule>]`), one
 * line per diagnostic.
 */
function about(output: string, path: string): string[] {
    return output
        .split('\n')
        .filter((line) => line.startsWith(`${path}:`))
        .map((line) => /jterrazz\((?<id>[a-z0-9-]+)\)/u.exec(line)?.groups?.id ?? '')
        .filter(Boolean);
}

describe('lint — k4-reach-per-path (meta-test)', () => {
    test('every role is judged by the rules that state they reach it', async () => {
        // Given - one run over a project holding a file in every role
        const output = await reachRun();

        // Then - `tests` reaches all four test roles, `module` only the plain one, `specification` and `config` only their own file
        expect(about(output, 'src/widget.test.ts')).toStrictEqual(
            expect.arrayContaining([
                'j2-no-sleep',
                'e9w-env-assignment-in-test',
                'g4-no-dom-in-module-test',
            ]),
        );
        expect(about(output, 'src/panel.test.tsx')).toStrictEqual(
            expect.arrayContaining(['j2-no-sleep', 'e9w-env-assignment-in-test']),
        );
        expect(about(output, 'src/panel.test.tsx')).not.toContain('g4-no-dom-in-module-test');
        expect(about(output, 'specs/api/orders/total.spec.ts')).toStrictEqual(
            expect.arrayContaining(['j2-no-sleep', 'e9w-env-assignment-in-test']),
        );
        expect(about(output, 'specs/api/orders/total.spec.ts')).not.toContain(
            'g4-no-dom-in-module-test',
        );
    });

    test('a repository suite is out of reach of the rules that judge a unit', async () => {
        // Given - the same run, read at the consistency suite's own path
        const output = await reachRun();
        const suite = about(output, 'specs/build/graph.test.ts');

        // Then - the test rules reach it, and the ones that would call it misplaced do not: C1's declared depth is what judges its shape, and I2's orphan clause stops at the specs boundary
        expect(suite).toStrictEqual(
            expect.arrayContaining(['j2-no-sleep', 'e9w-env-assignment-in-test']),
        );
        expect(suite).not.toContain('c1-domain-structure');
        expect(suite).not.toContain('i2-sibling-test-naming');
        expect(suite).not.toContain('g4-no-dom-in-module-test');
    });

    test('a config inside the tree, the ground beside a spec and a contract are each judged where they sit', async () => {
        // Given - the same run, read at the three paths the role-gated rows name
        const output = await reachRun();

        // Then - the config INSIDE `specs/` is still a config (spwn's shape), the contract answers for itself, and the ground answers through the spec that owns it — oxlint never opens a `.json`
        expect(about(output, 'specs/vitest.config.ts')).toContain('e4w-project-binding');
        expect(about(output, 'specs/api/orders/contracts/rates.ts')).toContain('c4-contract-shape');
        expect(about(output, 'specs/api/orders/total.spec.ts')).toContain('c2-http-only-requests');
        expect(about(output, 'specs/api/orders/contracts/rates.ts')).not.toContain('j2-no-sleep');
    });

    test('the specification and the config are judged by their own rules alone', async () => {
        // Given - the same run, read at the two files that declare rather than test
        const output = await reachRun();

        // Then - each carries the rule whose reach names its role, and neither carries a rule that reaches tests
        expect(about(output, 'specs/api/api.specification.ts')).toContain(
            'a3-no-destructure-alias',
        );
        expect(about(output, 'vitest.config.ts')).toContain('e2-preset-config');
        expect(about(output, 'vitest.config.ts')).not.toContain('j2-no-sleep');
        expect(about(output, 'vitest.config.ts')).not.toContain('e9w-env-assignment-in-test');
    });
});
