import { afterThisTest, providedViewport, setViewport } from '../page/page-runtime.js';
import type { ViewportPort } from './viewport.port.js';

/** Restored to the project's size when the test ends, so a narrow render never leaks. */
export const pageViewport: ViewportPort = {
    size: async (size) => {
        await setViewport(size);
        afterThisTest(async () => {
            await setViewport(providedViewport());
        });
        return {};
    },
};
