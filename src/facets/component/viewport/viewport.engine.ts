import { afterThisTest, providedViewport, setViewport } from '../page/page-runtime.js';
import type { ViewportPort } from './viewport.port.js';

/**
 * The size of the PAGE a component renders into. It is resized for the
 * render and restored to the project's size when the test ends, so a narrow
 * render never leaks into the next test.
 */
export const pageViewport: ViewportPort = {
    size: async (size) => {
        await setViewport(size);
        afterThisTest(async () => {
            await setViewport(providedViewport());
        });
        return {};
    },
};
