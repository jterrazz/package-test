/**
 * The refusals the browser build ships in place of what only node can do.
 *
 * `@jterrazz/test` has ONE specifier and two runtimes, so the page gets the
 * same NAMES as the server: a component test that reaches for
 * `specification.api()` or `postgres()` fails on the line that reached, saying
 * where that name runs — not on an unresolved import three layers down, and
 * not silently on `undefined`.
 */

/**
 * The refusal, in one line, whatever the name. Returns `never`, so a stub is
 * an ordinary arrow function the page's entry annotates with the node
 * signature — no cast, and no way for the two surfaces to disagree.
 */
export function refuse(name: string): never {
    throw new Error(
        `${name} runs under node: a page has no filesystem, no child process and no socket. ` +
            'Specify it from a test collected by a node project (unit/api/jobs/cli/website/mobile); ' +
            'a rendered thing is a `.test.tsx` beside its component.',
    );
}

/**
 * A node-only CLASS, present under the same name. A class has a shape a stub
 * cannot honour — every instance member of the real one — so this is the one
 * place the page's entry states a type it does not structurally satisfy; what
 * the value can actually do is throw, which is the whole of the contract.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the stub is deliberately narrower than the class it stands in for: constructing it is the only thing a page may do with it, and that throws
export const nodeOnlyClass = (name: string): never => (() => refuse(name)) as never;
