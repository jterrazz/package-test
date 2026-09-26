import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { staleIncludes } from './file-suffix-matches-place.stale-includes.js';

function packageWithConfig(config: string): string {
    const root = mkdtempSync(join(tmpdir(), 'stale-includes-'));
    mkdirSync(join(root, 'specs', 'api'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{ "name": "fixture" }\n');
    writeFileSync(join(root, 'vitest.config.ts'), config);
    return root;
}

describe('staleIncludes', () => {
    test('file-suffix-matches-place.stale-includes — names each include or exclude entry that reaches a file the run renamed', () => {
        // Given - a config whose glob and literal entries reach the renamed spec, after a URL whose `//` is no comment, below a commented-out entry
        const root = packageWithConfig(
            [
                'export default {',
                "    // include: ['specs/**/*.test.ts'],",
                "    include: ['http://localhost/a', 'specs/api/**/*.test.ts', 'specs/api/orders.test.ts', 'src/**/*.test.ts'],",
                "    exclude: ['specs/api/orders.test.ts'],",
                '};',
                '',
            ].join('\n'),
        );
        const from = join(root, 'specs', 'api', 'orders.test.ts');

        // When - the notices for a run that renamed that one spec
        const notices = staleIncludes(root, [{ from, to: from.replace('.test.ts', '.spec.ts') }]);

        // Then - the glob and both literal entries are named; the commented-out entry and the unrelated glob are not
        expect(notices).toStrictEqual([
            'vitest.config.ts: specs/api/**/*.test.ts still names `.test.ts` — the files it collected are `.spec.ts` now, and the project collects nothing until the glob follows (file-suffix-matches-place)',
            'vitest.config.ts: specs/api/orders.test.ts names a file this run renamed — it is `specs/api/orders.spec.ts` now, and the entry collects nothing until it follows (file-suffix-matches-place)',
            'vitest.config.ts: specs/api/orders.test.ts names a file this run renamed — it is `specs/api/orders.spec.ts` now, and the entry collects nothing until it follows (file-suffix-matches-place)',
        ]);
    });

    test('file-suffix-matches-place.stale-includes — says nothing when the run renamed nothing', () => {
        // Given - a config collecting `.test.ts` files
        const root = packageWithConfig("export default { include: ['specs/**/*.test.ts'] };\n");

        // Then - no rename, no notice
        expect(staleIncludes(root, [])).toStrictEqual([]);
    });
});
