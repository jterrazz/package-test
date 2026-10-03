import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../testing/package-tree.fixtures.js';
import { isNode } from './ast.js';
import type { AstNode } from './ast.js';
import { parseProgram } from './module-parser.js';
import {
    literalPathVisitor,
    mergeVisitors,
    pathReferenceVisitor,
    visitProgram,
} from './path-references.js';

const ROOT = packageWith({ 'src/a.ts': '' });

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

function literalPathsIn(source: string): string[][] {
    const program = parseProgram(join(ROOT, 'src/a.ts'), source);
    const paths: string[][] = [];
    if (isNode(program)) {
        visitProgram(
            program,
            literalPathVisitor(({ pieces }) => {
                paths.push(pieces);
            }),
        );
    }
    return paths;
}
describe('path-references', () => {
    test('pathReferenceVisitor — names each path a module builds from where it sits, or reads by a relative literal', () => {
        // Given - one module using each form
        const source = [
            'const here = import.meta.dirname;',
            "const a = new URL('./_fixtures/a.json', import.meta.url);",
            "const b = join(here, '_seeds', name);",
            `const c = \`\${__dirname}/_expected/c.txt\`;`,
            "const d = readFileSync('./specs/d.sql');",
            'export const there = __dirname;',
            "const e = join(there, '_e');",
        ].join('\n');

        // Then - the four paths, each resolved where the module or the project sits
        expect(pathsIn(source)).toStrictEqual([
            join(ROOT, 'src/_fixtures/a.json'),
            join(ROOT, 'src/_seeds'),
            join(ROOT, 'src/_expected/c.txt'),
            join(ROOT, 'specs/d.sql'),
            join(ROOT, 'src/_e'),
        ]);
    });

    test('pathReferenceVisitor — names no path built from a root the caller hands in', () => {
        // Given - paths that do not start where the module sits, or name nothing, or are read by no reader
        const source = [
            'const root = cwd();',
            'let unset;',
            "const unsetPath = join(unset, '_fixtures');",
            'const { dirname } = import.meta;',
            "const a = join(root, '_fixtures');",
            "const b = new URL('./x', base);",
            'const c = readFileSync(name);',
            "const d = join(cwd(), '_fixtures');",
            "const e = [join(), join(import.meta.dirname), copy(import.meta.dirname, 'x')];",
            `const f = [\`x\${__dirname}/a\`, \`\${__dirname}a\`, \`plain\`];`,
            "const g = [new Foo('./x', import.meta.url), new URL(name, import.meta.url)];",
            "const h = [readFileSync('specs/x'), readFileSync('a/./b'), fetch('./x')];",
        ].join('\n');

        // Then - none of them is the module's own tree
        expect(pathsIn(source)).toStrictEqual([]);
    });

    test('literalPathVisitor — hands every piece of a path built from the directory with literals alone', () => {
        // Given - each anchor, each builder, one piece and several, and a URL
        const source = [
            "const a = join(import.meta.dirname, '_expected', 'x.txt');",
            "const b = resolve(__dirname, '..', '_fixtures', 'gone');",
            "const c = path.join(import.meta.dirname, './_seeds/rows.sql');",
            "const d = new URL('./_fixtures/a.json', import.meta.url);",
        ].join('\n');

        // Then - the pieces of each, as written
        expect(literalPathsIn(source)).toStrictEqual([
            ['_expected', 'x.txt'],
            ['..', '_fixtures', 'gone'],
            ['./_seeds/rows.sql'],
            ['./_fixtures/a.json'],
        ]);
    });

    test('literalPathVisitor — hands no path with a computed piece, nor one built from another root', () => {
        // Given - a computed piece, a binding of the directory, a file for an anchor
        const source = [
            'const here = import.meta.dirname;',
            "const a = join(import.meta.dirname, '_fixtures', name);",
            "const b = join(here, '_fixtures');",
            "const c = resolve(import.meta.filename, 'x');",
            'const d = resolve(import.meta.dirname);',
            "const e = copy(import.meta.dirname, 'x');",
            "const f = join(other.dirname, 'x');",
            "const g = [new URL('./x', base), new URL('./x', other.url)];",
        ].join('\n');

        // Then - none of them is a path named whole
        expect(literalPathsIn(source)).toStrictEqual([]);
    });

    test('mergeVisitors — runs every fragment that handles a node type, in order', () => {
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
