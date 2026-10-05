import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { lint } from '../lint.specification.js';

/** `every-reach-proven` — the reach of a rule, proven on one project holding every path role, from a single oxlint run so the assertions are comparable. */
async function reachRun(): Promise<string> {
    const result = await lint
        .rules({ 'jterrazz/specs-at-declared-depth': ['error', { depth: 'specification' }] })
        .fixture(directory('./_fixtures/lint-reach/'))
        .run();
    return result.report.text;
}

/** A diagnostic's head line, `<path>:<line>:<col>  <plugin>(<rule>)`; its message lines are indented. */
function about(output: string, path: string): string[] {
    return output
        .split('\n')
        .filter((line) => line.startsWith(`${path}:`))
        .map((line) => /jterrazz\((?<id>[a-z0-9-]+)\)/u.exec(line)?.groups?.id ?? '')
        .filter(Boolean);
}

describe('every-reach-proven', () => {
    test('every role is judged by the rules that state they reach it', async () => {
        // Given - one run over a project holding a file in every role
        const output = await reachRun();

        // Then - `tests` reaches all four test roles, `module` only the plain one, `specification` and `config` only their own file
        expect(about(output, 'src/widget.test.ts')).toStrictEqual(
            expect.arrayContaining(['no-sleep', 'no-raw-env-write', 'no-dom-in-module-test']),
        );
        expect(about(output, 'src/panel.test.tsx')).toStrictEqual(
            expect.arrayContaining(['no-sleep', 'no-raw-env-write']),
        );
        expect(about(output, 'src/panel.test.tsx')).not.toContain('no-dom-in-module-test');
        expect(about(output, 'specs/api/orders/total.spec.ts')).toStrictEqual(
            expect.arrayContaining(['no-sleep', 'no-raw-env-write']),
        );
        expect(about(output, 'specs/api/orders/total.spec.ts')).not.toContain(
            'no-dom-in-module-test',
        );
    });

    test('a repository suite is out of reach of the rules that judge a unit', async () => {
        // Given - the same run, read at the consistency suite's own path
        const output = await reachRun();
        const suite = about(output, 'specs/build/graph.test.ts');

        // Then - the test rules reach it, and the ones that would call it misplaced do not: `specs-at-declared-depth`'s declared depth is what judges its shape — a spec with no specification folder is what it refuses — and `test-beside-its-module`'s orphan clause stops at the specs boundary
        expect(suite).toStrictEqual(expect.arrayContaining(['no-sleep', 'no-raw-env-write']));
        expect(suite).not.toContain('specs-at-declared-depth');
        expect(about(output, 'specs/stray.spec.ts')).toContain('specs-at-declared-depth');
        expect(suite).not.toContain('test-beside-its-module');
        expect(suite).not.toContain('no-dom-in-module-test');
    });

    test('the ground beside a spec and a stub are each judged where they sit', async () => {
        // Given - the same run, read at the three paths the role-gated rows name
        const output = await reachRun();

        // Then - the stub answers for itself, and the ground answers through the spec that owns it — oxlint never opens a `.json`
        expect(about(output, 'specs/api/orders/_setup/stubs/rates.ts')).toContain(
            'stubs-root-holds-facades-and-kinds',
        );
        expect(about(output, 'specs/api/orders/total.spec.ts')).toContain(
            'request-file-extension-known',
        );
        expect(about(output, 'specs/api/orders/_setup/stubs/rates.ts')).not.toContain('no-sleep');
    });

    test('the specification and the settings file are judged by their own rules alone', async () => {
        // Given - the same run, read at the two files that declare rather than test
        const output = await reachRun();

        // Then - each carries the rule whose reach names its role, and neither carries a rule that reaches tests
        expect(about(output, 'specs/api/api.specification.ts')).toContain('no-runner-alias');
        expect(about(output, 'jterrazz.config.ts')).toContain('include-points-at-a-folder');
        expect(about(output, 'jterrazz.config.ts')).not.toContain('no-sleep');
        expect(about(output, 'jterrazz.config.ts')).not.toContain('no-raw-env-write');
    });

    test('a specification that registers no cleanup is judged by `cleanup-passed-to-after-all`, and a spec beside it is not', async () => {
        // Given - the same run, read at a runner file with no afterAll and at a spec
        const output = await reachRun();

        // Then - `cleanup-passed-to-after-all`'s reach is the specification role, and nothing else
        expect(about(output, 'specs/api/rates.specification.ts')).toContain(
            'cleanup-passed-to-after-all',
        );
        expect(about(output, 'specs/api/orders/total.spec.ts')).not.toContain(
            'cleanup-passed-to-after-all',
        );
    });

    test('a spec is judged by the rules that reach specs alone, and no other test is', async () => {
        // Given - the same run, read at a spec and a module test sharing a catch-all name
        const output = await reachRun();

        // Then - `spec-named-for-its-aspect`'s reach is the spec role: the spec is refused its name, the module test is none of its business
        expect(about(output, 'specs/api/orders/misc.spec.ts')).toContain(
            'spec-named-for-its-aspect',
        );
        expect(about(output, 'src/misc.test.ts')).not.toContain('spec-named-for-its-aspect');
    });

    test('every test file is judged by the rules that reach tests, whatever its kind', async () => {
        // Given - the same run, read at the specification spec, a module test and a repository suite, none holding a describe
        const output = await reachRun();

        // Then - `one-describe-per-file` reaches all three
        expect(about(output, 'specs/api/orders/total.spec.ts')).toContain('one-describe-per-file');
        expect(about(output, 'src/widget.test.ts')).toContain('one-describe-per-file');
        expect(about(output, 'specs/build/graph.test.ts')).toContain('one-describe-per-file');
    });
});
