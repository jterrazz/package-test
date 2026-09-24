import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { parseProgram } from '../src/seams/oxc-parser/parse.js';
import { isNode } from './ast.js';
import { mergeVisitors, pathReferenceVisitor, visitProgram } from './path-references.js';
import type { AstNode } from './rule-shape.js';
import { packageWith } from './rule-tester.fixtures.js';

const ROOT = packageWith({ 'src/a.ts': '' });

/** The paths a module at `src/a.ts` names, in the order they are written. */
function pathsIn(source: string): string[] {
    const file = join(ROOT, 'src/a.ts');
    const program = parseProgram(file, source);
    const paths: string[] = [];
    if (isNode(program)) {
        visitProgram(
            program,
            pathReferenceVisitor(
                () => file,
                ({ path }) => {
                    paths.push(path);
                },
            ),
        );
    }
    return paths;
}

describe('pathReferenceVisitor', () => {
    test('names each path a module builds from where it sits, or reads by a relative literal', () => {
        // Given - one module using each form
        const source = [
            'const here = import.meta.dirname;',
            "const a = new URL('./fixtures/a.json', import.meta.url);",
            "const b = join(here, 'seeds', name);",
            `const c = \`\${__dirname}/expected/c.txt\`;`,
            "const d = readFileSync('./specs/d.sql');",
        ].join('\n');

        // Then - the four paths, each resolved where the module or the project sits
        expect(pathsIn(source)).toStrictEqual([
            join(ROOT, 'src/fixtures/a.json'),
            join(ROOT, 'src/seeds'),
            join(ROOT, 'src/expected/c.txt'),
            join(ROOT, 'specs/d.sql'),
        ]);
    });

    test('names no path built from a root the caller hands in', () => {
        // Given - paths that do not start where the module sits
        const source = [
            "const a = join(root, 'fixtures');",
            "const b = new URL('./x', base);",
            'const c = readFileSync(name);',
        ].join('\n');

        // Then - none of them is the module's own tree
        expect(pathsIn(source)).toStrictEqual([]);
    });
});

describe('mergeVisitors', () => {
    test('runs every fragment that handles a node type, in order', () => {
        // Given - two fragments on the same node type, and one on another
        const seen: string[] = [];
        const visitor = mergeVisitors(
            {
                Identifier: () => {
                    seen.push('first');
                },
            },
            {
                Identifier: () => {
                    seen.push('second');
                },
                Literal: () => {
                    seen.push('literal');
                },
            },
        );
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the handlers under test read the type alone, never the span a parsed node carries
        const node = { type: 'Identifier' } as AstNode;
        const { Identifier: onIdentifier } = visitor;
        onIdentifier?.(node);

        // Then - both ran, the first one first, and the other type kept its handler
        expect(seen).toStrictEqual(['first', 'second']);
        expect(Object.keys(visitor)).toStrictEqual(['Identifier', 'Literal']);
    });
});
