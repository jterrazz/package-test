import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';

import { child, childList, isNamedKey, isNode, isUnderSpecs, specsAnchor } from './ast.js';
import type { AstNode } from './ast.js';
import { parseProgram } from './module-parser.js';

/** The anchor probes the real filesystem for `package.json`, so the fixtures are real directories. */
const root = mkdtempSync(resolve(tmpdir(), 'specs-anchor-'));

const project = join(root, 'project');
const underSpecs = join(root, 'specs', 'project');
const nested = join(project, 'specs', 'fixtures', 'lint-violations', 'case', 'specs');

for (const dir of [
    join(project, 'specs', 'api', 'requests'),
    join(project, 'src', 'core'),
    join(nested, 'integrations'),
    join(underSpecs, 'src'),
]) {
    mkdirSync(dir, { recursive: true });
}
writeFileSync(join(project, 'package.json'), '{}');
writeFileSync(join(underSpecs, 'package.json'), '{}');

afterAll(() => {
    rmSync(root, { force: true, recursive: true });
});

function propertiesOf(expression: string): AstNode[] {
    const program = parseProgram('value.ts', `const value = ${expression};`);
    const [statement] = isNode(program) ? childList(program, 'body') : [];
    return childList(child(childList(statement, 'declarations')[0], 'init'), 'properties');
}

describe('ast', () => {
    test('specsAnchor — anchors a spec on its specs/ directory and lists the way down', () => {
        // Given - a test at facet/domain depth
        const file = join(project, 'specs', 'api', 'requests', 'headers.test.ts');

        // Then - the anchor is the specs dir, and the relative segments are [facet, domain, basename] — the depth `specs-at-declared-depth` measures
        const anchor = specsAnchor(file);
        expect(anchor?.directory).toBe(join(project, 'specs'));
        expect(anchor?.relative).toStrictEqual(['api', 'requests', 'headers.test.ts']);
    });

    test('specsAnchor — returns undefined for a file outside any specs tree', () => {
        // Given - production code in the same package
        const file = join(project, 'src', 'core', 'match.ts');

        // Then - no anchor
        expect(specsAnchor(file)).toBeUndefined();
        expect(isUnderSpecs(file)).toBeFalsy();
    });

    test('specsAnchor — takes the NEAREST specs ancestor, not the outermost', () => {
        // Given - a fixture project nested inside the repo's own specs tree — the shape where an innermost search and an outermost one read one file as two different facets
        const file = join(nested, 'integrations', 'adapter.test.ts');

        // Then - one answer: the innermost tree owns the file
        const anchor = specsAnchor(file);
        expect(anchor?.directory).toBe(nested);
        expect(anchor?.relative).toStrictEqual(['integrations', 'adapter.test.ts']);
    });

    test('specsAnchor — stops at the package root — a checkout under ~/specs/ is not a specs tree', () => {
        // Given - the package cloned inside a directory that happens to be named `specs` (the hazard: a bare "is `specs` a segment" test matched it, and `no-test-code-in-production` then stopped protecting this repo's production code entirely)
        const file = join(underSpecs, 'src', 'app.ts');

        // Then - the search never climbs past the package's own package.json
        expect(specsAnchor(file)).toBeUndefined();
        expect(isUnderSpecs(file)).toBeFalsy();
    });

    test('specsAnchor — anchors a specs tree that lives under that same outer directory', () => {
        // Given - a real spec inside the package cloned under ~/specs/
        const file = join(underSpecs, 'specs', 'cli', 'exec', 'exec.test.ts');

        // Then - its OWN specs/ anchors it; the outer directory is irrelevant
        expect(specsAnchor(file)?.directory).toBe(join(underSpecs, 'specs'));
    });

    test('specsAnchor — anchors a file sitting directly in specs/', () => {
        // Given - a runner at the specs root
        const file = join(project, 'specs', 'api.specification.ts');

        // Then - the relative path is the basename alone (`specs-at-declared-depth` depth 0)
        expect(specsAnchor(file)?.relative).toStrictEqual(['api.specification.ts']);
    });

    test('specsAnchor — answers for a path with no package.json anywhere above it', () => {
        // Given - a filename that exists only as a string (how the rule testers address the rules, and how a virtual/in-memory file arrives)
        const file = '/nowhere/repo/specs/lint/hygiene/title.test.ts';

        // Then - the walk simply runs out of ancestors, and the specs dir wins
        expect(specsAnchor(file)?.directory).toBe('/nowhere/repo/specs');
        expect(specsAnchor(file)?.relative).toStrictEqual(['lint', 'hygiene', 'title.test.ts']);
    });

    test('isNamedKey — a key is named when it is written as it is, never when it is computed', () => {
        // Given - a bare key, a string key and a computed one
        const keys = propertiesOf("{ root: 1, 'as-written': 2, [String(3)]: 3 }");

        // Then - the computed key runs an expression
        expect(keys.map(isNamedKey)).toStrictEqual([true, true, false]);
    });
});
