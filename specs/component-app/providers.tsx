import type { ReactNode } from 'react';

/**
 * The project's `wrap` — the frame every render of the `component` project is
 * dressed in, the way an app's providers dress every screen.
 *
 * It is a module path in `vitest.config.ts`, not a function passed in code:
 * the page imports it, and a page can only import a URL.
 */
export default function Providers(ui: ReactNode): ReactNode {
    return <main>{ui}</main>;
}
