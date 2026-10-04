import { refusal } from './refusal.js';

export function refuse(name: string): never {
    throw new Error(
        refusal({
            fix: 'specify it from a test collected by a node project (unit/api/job/cli/website/mobile); a rendered thing is a `.test.tsx` beside its component',
            found: `${name} runs under node, and was called in a page`,
            read: 'docs/guides/component-specs.md#what-it-does-not-do',
            why: 'A page has no filesystem, no child process and no socket.',
        }),
    );
}

/** A constructible function, never an arrow: `new` on an arrow throws before the refusal runs. */
export function nodeOnlyClass(name: string): never {
    function NodeOnly(): never {
        return refuse(name);
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the page entry publishes the node entry's types whole, so a node-only class is typed as the class it stands for and refuses when constructed
    return NodeOnly as never;
}
