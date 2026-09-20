/**
 * What a component test hands to `.render()`.
 *
 * The React types live on THIS side of the seam, with the adapter that mounts
 * them: `react` is an optional peer, and the model
 * (`specification/facets/component/`) states what a render IS without knowing
 * which library draws it. A project that specifies no component installs
 * neither react nor the browser adapter, and `skipLibCheck` — which every
 * `@jterrazz/typescript` profile sets — keeps the unresolved type off its build.
 */
export type { ReactNode as ComponentUi } from 'react';

/**
 * A vanilla DOM subject: a function handed the container it must fill. Its
 * optional return is the teardown, the way a DOM library states one.
 */
// oxlint-disable-next-line typescript/no-invalid-void-type -- `void` in the union IS the shape: a mount with nothing to tear down is written with no `return` at all, which is what a DOM library's own signature says
export type DomMount = (container: HTMLElement) => (() => void) | void;

/**
 * The `server.commands` this seam registers, declared in the module every part
 * of the seam already imports.
 *
 * A `declare module` merges only as an interface, and only from a file that is
 * itself a module and part of the program — a lone `.d.ts` would have to be
 * pulled in by an empty import, and its single `export {}` is exactly what a
 * formatter is free to drop, turning the augmentation into an ambient
 * declaration that SHADOWS the module it meant to extend.
 */
declare module 'vitest/browser' {
    // oxlint-disable-next-line typescript/consistent-type-definitions -- `BrowserCommands` is vitest's own interface and only an interface merges into it
    interface BrowserCommands {
        ariaTree: () => Promise<string>;
        goldenRead: (name: string) => Promise<null | string>;
        goldenWrite: (name: string, content: string) => Promise<string>;
    }
}
