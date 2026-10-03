import { describe, expect, test } from 'vitest';
import { Pair, YAMLMap, YAMLSeq } from 'yaml';

import {
    blockScalar,
    nodeItems,
    nodePairs,
    parseYamlSource,
    renderYamlSource,
    Scalar,
    yamlSyntaxErrors,
} from './yaml-document.js';

function rewritten(step: number, text: string): string {
    const source = parseYamlSource(['runs:', `${' '.repeat(step)}- exit: 0`, ''].join('\n'));
    source.document.setIn(['runs', 0, 'stdout'], blockScalar(text));
    return renderYamlSource(source);
}

function readBack(rendered: string): unknown {
    return parseYamlSource(rendered).document.getIn(['runs', 0, 'stdout']);
}

const FORMATTED = [
    '# the ground of the case',
    'description: writes what it was told to',
    'runs:',
    '    - command: scaffold',
    '      exit: 0',
    '      files:',
    "          out/main.go: { contains: 'package main' }",
    "          out/docs/README.md: { contains: ['# Docs', 'second needle'] }",
    '          out/long.txt:',
    '              {',
    "                  contains: ['a needle long enough that the formatter broke it over lines'],",
    '              }',
    '',
].join('\n');
describe('yaml-document', () => {
    test('document — yaml document — a block scalar states its indentation — a stream opening on a space reads back byte for byte at four spaces', () => {
        // Given - a four-space document, the step oxfmt formats YAML at
        const text = ' TYPESCRIPT  src/index.ts\nsecond line\n';
        const rendered = rewritten(4, text);

        // Then - the indicator names the four spaces the content is written at
        expect(rendered).toContain('stdout: |4\n');

        // Then - and the value survives the round trip unchanged
        expect(readBack(rendered)).toBe(text);
    });

    test('document — yaml document — a block scalar states its indentation — the same stream reads back byte for byte at two spaces', () => {
        // Given - a two-space document, YAML's own default step
        const text = ' TYPESCRIPT  src/index.ts\nsecond line\n';
        const rendered = rewritten(2, text);

        // Then - two spaces is what the indicator names there
        expect(rendered).toContain('stdout: |2\n');
        expect(readBack(rendered)).toBe(text);
    });

    test('document — yaml document — a block scalar states its indentation — several leading spaces are kept, not counted', () => {
        // Given - a stream indented four spaces of its own, in a four-space document
        const text = '    deeply indented\nback\n';
        const rendered = rewritten(4, text);

        // Then - the indicator still names the document's step; the value's own spaces are content and come back with it
        expect(rendered).toContain('stdout: |4\n');
        expect(readBack(rendered)).toBe(text);
    });

    test('document — yaml document — a block scalar states its indentation — a stream opening on a tab needs no indicator and survives without one', () => {
        // Given - a tab-started stream, which YAML never reads as indentation
        const text = '\tTABBED\nback\n';
        const rendered = rewritten(4, text);

        // Then - the writer states no indicator, and the round trip holds anyway
        expect(rendered).toContain('stdout: |\n');
        expect(readBack(rendered)).toBe(text);
    });

    test('document — yaml document — a block scalar states its indentation — a stream opening on a newline needs no indicator either', () => {
        // Given - a stream whose first line is empty
        const text = '\nafter the blank\n';
        const rendered = rewritten(4, text);

        // Then - nothing to state, and the blank line comes back
        expect(rendered).toContain('stdout: |\n');
        expect(readBack(rendered)).toBe(text);
    });

    test('document — yaml document — a block scalar states its indentation — a step deeper than one digit is refused, naming what cannot be written', () => {
        // Given - a document indented past the single digit an indicator is
        // Then - the render refuses rather than writing an indentation it cannot state
        expect(() => rewritten(10, ' leading space\n')).toThrow(
            'A block scalar indented by 10 spaces cannot state its indentation',
        );
    });

    test('document — yaml document — a rewrite leaves alone what it did not change — a document nobody edited comes back byte for byte', () => {
        // Given - unpadded flow sequences, a padded flow mapping, one broken over several lines, and a comment
        const source = parseYamlSource(FORMATTED);

        // Then - the render is the file, not the writer's house style
        expect(renderYamlSource(source)).toBe(FORMATTED);
    });

    test('document — yaml document — a rewrite leaves alone what it did not change — an edited stream is rewritten and its neighbours are not', () => {
        // Given - one stream written into the run, next to the flow collections
        const source = parseYamlSource(FORMATTED);
        source.document.setIn(['runs', 0, 'stdout'], blockScalar('Scaffolded\n'));

        // Then - the new key is there, spelled by the writer
        const rendered = renderYamlSource(source);
        expect(rendered).toContain('      stdout: |\n          Scaffolded\n');

        // Then - and every collection it did not touch is untouched, padding, quotes and line breaks included
        expect(rendered).toContain("out/docs/README.md: { contains: ['# Docs', 'second needle'] }");
        expect(rendered).toContain(
            [
                '          out/long.txt:',
                '              {',
                "                  contains: ['a needle long enough that the formatter broke it over lines'],",
                '              }',
            ].join('\n'),
        );
    });

    test('document — yaml document — a rewrite leaves alone what it did not change — a collection whose value changed is written by the writer, not restored', () => {
        // Given - a needle rewritten inside a flow collection
        const source = parseYamlSource(FORMATTED);
        source.document.setIn(['runs', 0, 'files', 'out/main.go', 'contains'], 'package rust');

        // Then - the change is what the file says; the untouched sibling stays
        const rendered = renderYamlSource(source);
        expect(rendered).toContain("out/main.go: { contains: 'package rust' }");
        expect(rendered).toContain("out/docs/README.md: { contains: ['# Docs', 'second needle'] }");
    });

    test('document — yaml document — the step a document is written with — a document whose list holds only flow entries comes back at its own step', () => {
        // Given - a four-space document whose one list is written in flow, and a key added to it
        const text = [
            'seed:',
            '    - { file: ./_seeds/one.sql, database: db }',
            '    - { file: ./_seeds/two.sql, database: db }',
            '',
        ].join('\n');
        const source = parseYamlSource(text);
        source.document.set('request', 'GET /users');

        // Then - the entries keep the four spaces they were written at
        expect(renderYamlSource(source)).toBe(`${text}request: GET /users\n`);
    });

    test.each([
        ['a: 1\n', 2],
        ['a:\n    bb: 1\n', 4],
        ['a:\n    - bb: 1\n', 4],
        ['a:\n    - [1, 2]\n', 4],
        ['a:\n    b: 1\nc:\n  dd: 1\n', 2],
        ["a: ' x y: z'\nb:\n    cc: 1\n", 4],
        ['a: |\n  - text\nb:\n    cc: 1\n', 4],
        ['a: |\n  1 text: x\nb:\n    cc: 1\n', 4],
    ])('the document %j is written at the step of its shallowest key line, %i', (text, step) => {
        // Given - key lines, list entries, quoted values and block text at mixed depths
        // Then - the step read is the shallowest key or flow entry, two when none is indented
        expect(parseYamlSource(text).indent).toBe(step);
    });

    test('a block scalar indicator is restated only at the head of a block scalar, up to the ninth space', () => {
        // Given - plain values that spell an indicator, and a nine-space document
        const source = parseYamlSource('a: x|2y\n');
        source.document.set('b', 'q|2z');

        // Then - the plain values are untouched, and nine spaces is still statable
        expect([renderYamlSource(source), rewritten(9, ' lead\n')]).toStrictEqual([
            'a: x|2y\nb: q|2z\n',
            'runs:\n         - exit: 0\n           stdout: |9\n                     lead\n',
        ]);
    });

    test('a syntax error names the line it was found on', () => {
        // Given - a flow sequence that never closes
        const source = parseYamlSource('a: 1\nb: [\nc: 1\n');

        // Then - each error carries the line of its position
        expect(yamlSyntaxErrors(source).map(({ line }) => line)).toStrictEqual(
            source.document.errors.map(({ linePos }) => linePos?.[0].line),
        );
    });

    test('the node readers keep only the pairs and items a parser could have written', () => {
        // Given - a map and a list holding raw values beside nodes
        const map = new YAMLMap();
        map.items.push(
            new Pair(new Scalar('kept'), new Scalar(1)),
            new Pair(new Scalar('empty'), null),
            new Pair(new Scalar('raw value'), 1),
            new Pair('raw key', new Scalar(1)),
        );
        const seq = new YAMLSeq();
        seq.items.push(new Scalar(1), 2);

        // Then - the node pairs and items, nothing raw
        expect([
            nodePairs(map).map(({ key }) => String(key)),
            nodeItems(seq).map(String),
        ]).toStrictEqual([['kept', 'empty'], ['1']]);
    });

    test('a collection is restored from the source collection at its own depth, each source used once', () => {
        // Given - equal collections spelled apart, one nested and two at the top, and the nested one removed
        const kept = ['b: [1,  2]', 'e: [1, 2]', ''].join('\n');
        const source = parseYamlSource(`c:\n    d: [ 1, 2 ]\n${kept}`);
        source.document.delete('c');

        // Then - each kept collection keeps its own spelling
        expect(renderYamlSource(source)).toBe(kept);
    });
});
