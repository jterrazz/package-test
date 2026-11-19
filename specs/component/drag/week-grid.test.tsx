import { component, testId } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { WeekGrid } from './week-grid.js';

// testId: the week is one image, and the vocabulary names no image
const week = testId('week');

// value: the middle of the nth of the week's ten squares, in fractions of its box.
const day = (nth: number): { x: number; y: number } => ({ x: (nth - 0.5) / 10, y: 0.5 });

describe('WeekGrid', () => {
    test('presses on one square, passes over every square between, and releases on the last', async () => {
        // Given - a visitor dragging across the week from its 2nd square to its 7th
        const result = await component.render(<WeekGrid />, async (visitor) => {
            await visitor.drag(week, day(2), day(7));
        });

        // Then - the component saw the press, a move over each square in order, and the release
        expect(result.content.text).toContain('down 2 · 3 · 4 · 5 · 6 · 7 · up 7');
    });

    test('keeps moving past the edge of the target, and releases there', async () => {
        // Given - a drag from the 9th square to half the week's width past its end
        const result = await component.render(<WeekGrid />, async (visitor) => {
            await visitor.drag(week, day(9), { x: 1.5, y: 0.5 });
        });

        // Then - the moves went on outside the week, and the release reached it through its capture
        expect(result.content.text).toContain('down 9 · 10 · out · up out');
    });

    test('waits for a target drawn after the mount', async () => {
        // Given - a week drawn half a second after it mounts
        const result = await component.render(<WeekGrid delay={500} />, async (visitor) => {
            await visitor.drag(week, day(1), day(3));
        });

        // Then - the drag waited for it, and ran whole
        expect(result.content.text).toContain('down 1 · 2 · 3 · up 3');
    });

    test(
        'refuses a target that never shows, within the test budget',
        { timeout: 5000 },
        async () => {
            // Given - a drag on a week that is not on the screen
            const render = component.render(<WeekGrid delay={60_000} />, async (visitor) => {
                await visitor.drag(week, day(1), day(3));
            });

            // Then - the drag gave up on the budget the test had left, naming what it waited for
            await expect(render).rejects.toThrow(
                /^locator\.hover: Timeout \d+ms exceeded\.\nCall log:\n {2}- waiting for .*getByTestId\('week'\)\n$/u,
            );
        },
    );
});
