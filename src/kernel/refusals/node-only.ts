export function refuse(name: string): never {
    throw new Error(
        `${name} runs under node: a page has no filesystem, no child process and no socket. ` +
            'Specify it from a test collected by a node project (unit/api/job/cli/website/mobile); ' +
            'a rendered thing is a `.test.tsx` beside its component.',
    );
}

/** A constructible function, never an arrow: `new` on an arrow throws before the refusal runs. */
export const nodeOnlyClass = (name: string): never =>
    function NodeOnly(): never {
        return refuse(name);
    } as never;
