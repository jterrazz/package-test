import { refusal } from '../../../lint/index.refusal.js';

export function refuse(name: string): never {
    throw new Error(
        refusal({
            fix: 'specify it from a test collected by a node project (unit/api/job/cli/website/mobile); a rendered thing is a `.test.tsx` beside its component',
            found: `${name} runs under node, and was called in a page`,
            read: 'docs/07-component.md#what-it-does-not-do',
            why: 'A page has no filesystem, no child process and no socket.',
        }),
    );
}

/** A constructible function, never an arrow: `new` on an arrow throws before the refusal runs. */
export const nodeOnlyClass = (name: string): never =>
    function NodeOnly(): never {
        return refuse(name);
    } as never;
