import { testId } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { website } from '../website.specification.js';

// testId: the week is one image, and the vocabulary names no image
const week = testId('week');

// value: the middle of the nth of the week's ten squares, in fractions of its box.
const day = (nth: number): { x: number; y: number } => ({ x: (nth - 0.5) / 10, y: 0.5 });

describe('grid', () => {
    test('presses on one square, passes over every square between, and releases on the last', async () => {
        // Given - a visitor dragging across the week from its 2nd square to its 7th
        const result = await website.visit('/grid', async (visitor) => {
            await visitor.drag(week, day(2), day(7));
        });

        // Then - the page saw the press, a move over each square in order, and the release
        expect(result.content.text).toContain('down 2 · 3 · 4 · 5 · 6 · 7 · up 7');
    });

    test('keeps moving past the edge of the target, and releases there', async () => {
        // Given - a drag from the 9th square to half the week's width past its end
        const result = await website.visit('/grid', async (visitor) => {
            await visitor.drag(week, day(9), { x: 1.5, y: 0.5 });
        });

        // Then - the moves went on outside the week, and the release reached it through its capture
        expect(result.content.text).toContain('down 9 · 10 · out · up out');
    });

    test('waits for a target drawn after the page loaded', async () => {
        // Given - a week the page draws half a second after its load
        const result = await website.visit('/grid-late', async (visitor) => {
            await visitor.drag(week, day(1), day(3));
        });

        // Then - the drag waited for it, and ran whole
        expect(result.content.text).toContain('down 1 · 2 · 3 · up 3');
    });
});
