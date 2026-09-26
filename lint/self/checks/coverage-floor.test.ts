import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('coverage-floor', () => {
    test('what the count reaches — the child processes the suite spawns (meta-test) — every child is counted, and judged on the source its bundle maps back to', async () => {
        // Given - this repository's own config, which the documents running `dist/checker.js` run under
        const { default: config } = await import('../../../vitest.config.js');
        const coverage = config.test?.coverage;

        // Then - children attached, `dist/` read, and every path judged after the remap
        expect(
            coverage?.provider === 'v8'
                ? {
                      afterRemap: coverage.excludeAfterRemap,
                      attached: coverage.autoAttachSubprocess,
                      distRead: !(coverage.exclude ?? []).includes('dist/**'),
                  }
                : coverage,
        ).toStrictEqual({ afterRemap: true, attached: true, distRead: true });
    });

    test('what the count reaches — the child processes the suite spawns (meta-test) — every bundle carries the map back to its modules, and the tarball none of them', async () => {
        // Given - the build groups, and the files the package publishes
        const { default: groups } = await import('../../../tsdown.config.js');
        const manifest: unknown = JSON.parse(
            readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8'),
        );
        const files: unknown =
            typeof manifest === 'object' && manifest !== null && 'files' in manifest
                ? manifest.files
                : [];

        // Then - a map from every group, and none shipped
        expect({
            mapped: [groups].flat().map((group) => group.sourcemap),
            shipped: !(Array.isArray(files) && files.includes('!dist/**/*.map')),
        }).toStrictEqual({ mapped: [true, true, true, true], shipped: false });
    });
});
