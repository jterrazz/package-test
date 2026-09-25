import type { ComponentUi, DomMount } from '../page/ui.js';
import type { componentVerbs } from '../page/vitest-browser.adapter.js';

/** The interaction vocabulary a render scenario is handed — the When. */
export type ComponentVisitor = ReturnType<typeof componentVerbs>;

/** The behaviour of a render; assertions stay in the Then, on the result (W1). */
export type ComponentScenario = (visitor: ComponentVisitor) => Promise<void>;

/**
 * What `.render()` mounts. A React tree is an element (`<PostTable />`); a
 * vanilla DOM subject is the FUNCTION that fills a container, which is how a
 * DOM-only module is called in production too.
 */
export type RenderSubject = ComponentUi | DomMount;
