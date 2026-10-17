import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import { checkNoSimulatedDomInConfig } from '../no-simulated-dom-in-config.js';

describe('checkNoSimulatedDomInConfig', () => {
    test('a config giving its tests a simulated DOM is found on the line it names it, any other environment is not', () => {
        // Given - configs naming jsdom, happy-dom and node
        const root = packageWith({
            'a/vitest.config.ts':
                "export default {\n    test: {\n        environment: 'jsdom',\n    },\n};\n",
            'b/vitest.config.ts': 'export default { test: { environment: "happy-dom" } };\n',
            'c/vitest.config.ts': "export default { test: { environment: 'node' } };\n",
        });

        // Then - the two simulated ones, each told what to write instead
        expect(
            ['a', 'b', 'c'].flatMap((name) =>
                checkNoSimulatedDomInConfig(join(root, name, 'vitest.config.ts'), root).map(
                    ({ fix, found, line, path, rule }) =>
                        `${rule} ${path}:${line} ${found} — ${fix}`,
                ),
            ),
        ).toStrictEqual([
            "no-simulated-dom-in-config a/vitest.config.ts:3 `environment: 'jsdom'` gives every file of this project a drawing of a browser — delete `environment: 'jsdom'`, and write each rendered test as a `.test.tsx` in the `__tests__/` of its component's folder, collected by the `component` project",
            "no-simulated-dom-in-config b/vitest.config.ts:1 `environment: 'happy-dom'` gives every file of this project a drawing of a browser — delete `environment: 'happy-dom'`, and write each rendered test as a `.test.tsx` in the `__tests__/` of its component's folder, collected by the `component` project",
        ]);
    });
});
