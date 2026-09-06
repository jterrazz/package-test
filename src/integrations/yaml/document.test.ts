import { describe, expect, test } from 'vitest';

import { blockScalar, parseYamlSource, renderYamlSource } from './document.js';

/**
 * The `yaml` wrapper, read on its own — text in, text out. What is judged here
 * is the ROUND TRIP: a document this module renders must read back as the value
 * that was put into it, whatever step the file is indented with.
 */

/** A document indented by `step`, with `text` written into its one run's stdout. */
function rewritten(step: number, text: string): string {
    const source = parseYamlSource(['runs:', `${' '.repeat(step)}- exit: 0`, ''].join('\n'));
    source.document.setIn(['runs', 0, 'stdout'], blockScalar(text));
    return renderYamlSource(source);
}

/** The stdout a rendered document gives back when it is read again. */
function readBack(rendered: string): unknown {
    return (parseYamlSource(rendered).document.toJS() as { runs: { stdout: unknown }[] }).runs[0]
        ?.stdout;
}

describe('yaml document — a block scalar states its indentation', () => {
    test('a stream opening on a space reads back byte for byte at four spaces', () => {
        // Given - a four-space document, the step oxfmt formats YAML at
        const text = ' TYPESCRIPT  src/index.ts\nsecond line\n';
        const rendered = rewritten(4, text);

        // Then - the indicator names the four spaces the content is written at
        expect(rendered).toContain('stdout: |4\n');

        // Then - and the value survives the round trip unchanged
        expect(readBack(rendered)).toBe(text);
    });

    test('the same stream reads back byte for byte at two spaces', () => {
        // Given - a two-space document, YAML's own default step
        const text = ' TYPESCRIPT  src/index.ts\nsecond line\n';
        const rendered = rewritten(2, text);

        // Then - two spaces is what the indicator names there
        expect(rendered).toContain('stdout: |2\n');
        expect(readBack(rendered)).toBe(text);
    });

    test('several leading spaces are kept, not counted', () => {
        // Given - a stream indented four spaces of its own, in a four-space document
        const text = '    deeply indented\nback\n';
        const rendered = rewritten(4, text);

        // Then - the indicator still names the document's step; the value's own
        // Spaces are content and come back with it
        expect(rendered).toContain('stdout: |4\n');
        expect(readBack(rendered)).toBe(text);
    });

    test('a stream opening on a tab needs no indicator and survives without one', () => {
        // Given - a tab-started stream, which YAML never reads as indentation
        const text = '\tTABBED\nback\n';
        const rendered = rewritten(4, text);

        // Then - the writer states no indicator, and the round trip holds anyway
        expect(rendered).toContain('stdout: |\n');
        expect(readBack(rendered)).toBe(text);
    });

    test('a stream opening on a newline needs no indicator either', () => {
        // Given - a stream whose first line is empty
        const text = '\nafter the blank\n';
        const rendered = rewritten(4, text);

        // Then - nothing to state, and the blank line comes back
        expect(rendered).toContain('stdout: |\n');
        expect(readBack(rendered)).toBe(text);
    });

    test('a step deeper than one digit is refused, naming what cannot be written', () => {
        // Given - a document indented past the single digit an indicator is
        // Then - the render refuses rather than writing an indentation it cannot state
        expect(() => rewritten(10, ' leading space\n')).toThrow(
            'A block scalar indented by 10 spaces cannot state its indentation',
        );
    });
});
