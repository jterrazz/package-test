import { describe, expect, test } from 'vitest';

import { dragAcross } from '../pointer.js';
import type { BoxPoint, PointerDriver } from '../pointer.js';
import { testId } from '../targets/roles.js';

const WEEK = testId('week');

// value: a box 200 by 20 pixels at (100, 50).
const BOX = { height: 20, width: 200, x: 100, y: 50 };

const READ = 'read: docs/reference/visitor.md#drag-presses-on-the-target-and-moves-in-steps';

// invariant: every call the drag makes on the driver, in order.
function recording(box: null | typeof BOX): { calls: string[]; driver: PointerDriver } {
    const calls: string[] = [];
    const driver: PointerDriver = {
        locator: {
            boundingBox: async () => {
                calls.push('boundingBox');
                return await Promise.resolve(box);
            },
            hover: async (options) => {
                calls.push(`hover ${JSON.stringify(options)}`);
                await Promise.resolve();
            },
        },
        mouse: {
            down: async () => {
                calls.push('down');
                await Promise.resolve();
            },
            move: async (x, y, options) => {
                const steps = options === undefined ? '' : ` ${JSON.stringify(options)}`;
                calls.push(`move ${String(x)} ${String(y)}${steps}`);
                await Promise.resolve();
            },
            up: async () => {
                calls.push('up');
                await Promise.resolve();
            },
        },
    };
    return { calls, driver };
}

async function outcomeOf(from: BoxPoint, to: BoxPoint): Promise<string> {
    const { calls, driver } = recording(BOX);
    try {
        await dragAcross(driver, { from, target: WEEK, to });
    } catch (error) {
        return `${error instanceof Error ? error.message : String(error)}\n${calls.join(', ') || 'no call'}`;
    }
    return 'dragged';
}

function offBox(call: string): string {
    return [
        `found: drag(testId("week"), ${call}) presses outside its target`,
        'why: A drag presses on the element it names, at a fraction of its box.',
        'fix: press inside the box: `from` between 0 and 1 on each axis, { x: 0.5, y: 0.5 } its centre; only `to` may leave it',
        READ,
        'no call',
    ].join('\n');
}

function nowhere(call: string): string {
    return [
        `found: drag(testId("week"), ${call}) releases at no point of the page`,
        'why: A drag releases at a fraction of the box of the target it pressed on.',
        'fix: release at a finite fraction of the box: beyond 0 or 1 leaves it, which a drag may',
        READ,
        'no call',
    ].join('\n');
}

describe('pointer', () => {
    test('dragAcross — waits like hover, presses at `from`, moves to `to` a step every 4 pixels, and releases there', async () => {
        // Given - a target 200 pixels wide, and a drag across half of it
        const { calls, driver } = recording(BOX);

        // When - it drags from a quarter of the box to three quarters, at mid-height
        await dragAcross(driver, {
            from: { x: 0.25, y: 0.5 },
            target: WEEK,
            to: { x: 0.75, y: 0.5 },
        });

        // Then - one actionability wait, then the press at (150, 60), 25 steps over 100 pixels, the release at (250, 60)
        expect(calls).toStrictEqual([
            'hover {"trial":true}',
            'boundingBox',
            'move 150 60',
            'down',
            'move 250 60 {"steps":25}',
            'up',
        ]);
    });

    test('dragAcross — a deadline, a release past the box, and a drag that never moves — forwards the deadline and takes at least one step', async () => {
        // Given - a drag with a deadline that leaves the box diagonally, and one released where it pressed
        const leaving = recording(BOX);
        const still = recording(BOX);

        // When - both drag
        await dragAcross(leaving.driver, {
            from: { x: 1, y: 1 },
            target: WEEK,
            timeout: 1500,
            to: { x: 1.25, y: 2.5 },
        });
        await dragAcross(still.driver, { from: { x: 0, y: 0 }, target: WEEK, to: { x: 0, y: 0 } });

        // Then - the deadline reaches the wait, the release lands outside the box (50 by 30 pixels away, 58 pixels: 15 steps), and the still drag takes one
        expect([leaving.calls, still.calls]).toStrictEqual([
            [
                'hover {"timeout":1500,"trial":true}',
                'boundingBox',
                'move 300 70',
                'down',
                'move 350 100 {"steps":15}',
                'up',
            ],
            [
                'hover {"trial":true}',
                'boundingBox',
                'move 100 50',
                'down',
                'move 100 50 {"steps":1}',
                'up',
            ],
        ]);
    });

    test('dragAcross — a target that leaves the screen after the wait — refuses, and never presses', async () => {
        // Given - a target with no box once the wait answered
        const { calls, driver } = recording(null);

        // When - it drags
        const refused = dragAcross(driver, {
            from: { x: 0.5, y: 0.5 },
            target: WEEK,
            to: { x: 1, y: 0.5 },
        });

        // Then - refused naming the target, with the mouse untouched
        await expect(refused).rejects.toThrow(
            new Error(
                [
                    'found: testId("week") left the screen before the drag pressed on it',
                    'why: A drag presses where its target is drawn.',
                    'fix: wait for what keeps it on the screen, with see(), before the drag',
                    READ,
                ].join('\n'),
            ),
        );
        expect(calls).toStrictEqual(['hover {"trial":true}', 'boundingBox']);
    });

    test('dragAcross — a press outside the box, a point that is no number — refuses before any wait; a release outside it is a drag that leaves', async () => {
        // Given - the corners of the box, a press past each axis, a press and a release on no number
        const inside = { x: 0.5, y: 0.5 };

        // When - each drags
        const outcomes = await Promise.all([
            outcomeOf({ x: 0, y: 0 }, { x: 3, y: -2 }),
            outcomeOf({ x: 1, y: 1 }, inside),
            outcomeOf({ x: -0.01, y: 0.5 }, inside),
            outcomeOf({ x: 1.01, y: 0.5 }, inside),
            outcomeOf({ x: 0.5, y: -0.01 }, inside),
            outcomeOf({ x: 0.5, y: 1.01 }, inside),
            outcomeOf({ x: Number.NaN, y: 0.5 }, inside),
            outcomeOf(inside, { x: 0.5, y: Number.POSITIVE_INFINITY }),
            outcomeOf(inside, { x: Number.NaN, y: 0.5 }),
        ]);

        // Then - the corners and the leaving release drag, the rest are refused in the words of the call, and none of them waited
        expect(outcomes).toStrictEqual([
            'dragged',
            'dragged',
            offBox('{ x: -0.01, y: 0.5 }, { x: 0.5, y: 0.5 }'),
            offBox('{ x: 1.01, y: 0.5 }, { x: 0.5, y: 0.5 }'),
            offBox('{ x: 0.5, y: -0.01 }, { x: 0.5, y: 0.5 }'),
            offBox('{ x: 0.5, y: 1.01 }, { x: 0.5, y: 0.5 }'),
            offBox('{ x: NaN, y: 0.5 }, { x: 0.5, y: 0.5 }'),
            nowhere('{ x: 0.5, y: 0.5 }, { x: 0.5, y: Infinity }'),
            nowhere('{ x: 0.5, y: 0.5 }, { x: NaN, y: 0.5 }'),
        ]);
    });
});
