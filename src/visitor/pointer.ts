import { refusal } from '../chain/refusals/refusal.js';
import { asWritten } from './targets/as-written.js';
import type { Target } from './targets/target.js';

/** A point of a target's box in fractions of it: `{ x: 0, y: 0 }` is its top-left corner, `{ x: 1, y: 1 }` its bottom-right. */
export type BoxPoint = { x: number; y: number };

/** One drag: the target it presses on, the two points, and the deadline of its wait (none, the browser's own). */
export type DragOrder = { from: BoxPoint; target: Target; timeout?: number; to: BoxPoint };

type Box = { height: number; width: number; x: number; y: number };

/** What a drag needs of a browser: the target's actionability and box, and the real mouse. */
export type PointerDriver = {
    locator: {
        boundingBox: () => Promise<Box | null>;
        hover: (options: { timeout?: number; trial: true }) => Promise<void>;
    };
    mouse: {
        down: () => Promise<void>;
        move: (x: number, y: number, options?: { steps: number }) => Promise<void>;
        up: () => Promise<void>;
    };
};

// invariant: a move every 4 CSS pixels at most, so an element that narrow on the path still receives a `pointermove`.
const STEP_PX = 4;

function spelled(point: BoxPoint): string {
    return `{ x: ${String(point.x)}, y: ${String(point.y)} }`;
}

function onBox(point: BoxPoint): boolean {
    return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function refuseOffBox({ from, target, to }: DragOrder): void {
    const call = `drag(${asWritten(target)}, ${spelled(from)}, ${spelled(to)})`;
    if (!onBox(from)) {
        throw new Error(
            refusal({
                fix: 'press inside the box: `from` between 0 and 1 on each axis, { x: 0.5, y: 0.5 } its centre; only `to` may leave it',
                found: `${call} presses outside its target`,
                read: 'docs/reference/visitor.md#drag-presses-on-the-target-and-moves-in-steps',
                why: 'A drag presses on the element it names, at a fraction of its box.',
            }),
        );
    }
    if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) {
        throw new TypeError(
            refusal({
                fix: 'release at a finite fraction of the box: beyond 0 or 1 leaves it, which a drag may',
                found: `${call} releases at no point of the page`,
                read: 'docs/reference/visitor.md#drag-presses-on-the-target-and-moves-in-steps',
                why: 'A drag releases at a fraction of the box of the target it pressed on.',
            }),
        );
    }
}

/** Refuses a press off the box before any wait, waits like `hover()`, presses at `from`, moves to `to` a step every few pixels so each element on the way is passed over, and releases there. */
export async function dragAcross(driver: PointerDriver, order: DragOrder): Promise<void> {
    refuseOffBox(order);
    const { from, target, timeout, to } = order;
    await driver.locator.hover(timeout === undefined ? { trial: true } : { timeout, trial: true });
    const box = await driver.locator.boundingBox();
    if (box === null) {
        throw new Error(
            refusal({
                fix: 'wait for what keeps it on the screen, with see(), before the drag',
                found: `${asWritten(target)} left the screen before the drag pressed on it`,
                read: 'docs/reference/visitor.md#drag-presses-on-the-target-and-moves-in-steps',
                why: 'A drag presses where its target is drawn.',
            }),
        );
    }
    const start = { x: box.x + from.x * box.width, y: box.y + from.y * box.height };
    const end = { x: box.x + to.x * box.width, y: box.y + to.y * box.height };
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / STEP_PX));
    await driver.mouse.move(start.x, start.y);
    await driver.mouse.down();
    await driver.mouse.move(end.x, end.y, { steps });
    await driver.mouse.up();
}
