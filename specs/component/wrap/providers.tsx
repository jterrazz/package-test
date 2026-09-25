import type { ReactNode } from 'react';

/** A module path in `vitest.config.ts`, not a function: a page can only import a URL. */
export default function Providers(ui: ReactNode): ReactNode {
    return <main>{ui}</main>;
}
