import type { Armed } from '../../../kernel/chain/capability.js';
import { afterThisTest, providedViewport, setViewport } from '../page/page-runtime.js';

/**
 * The size of the PAGE a component renders into. It is resized for the
 * render and restored to the project's size when the test ends, so a narrow
 * render never leaks into the next test.
 */
export const pageViewport: {
    readonly size: (size: { height: number; width: number }) => Promise<Armed>;
} = {
    size: async (size) => {
        await setViewport(size);
        afterThisTest(async () => {
            await setViewport(providedViewport());
        });
        return {};
    },
};
