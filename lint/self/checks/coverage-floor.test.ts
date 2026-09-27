import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkCoverageFloor } from './coverage-floor.js';

const FLOOR = { 'all/branches': 70, 'all/functions': 80, 'all/lines': 76, 'all/statements': 76 };

const READ = 'read: docs/03-testing.md#coverage-is-a-ratchet-not-a-threshold';

describe('checkCoverageFloor', () => {
    test('coverage-floor — a run below its floor — refuses each fall as a four-part lesson', () => {
        // Given - a run that lost branches and lines
        const now = { ...FLOOR, 'all/branches': 69.5, 'all/lines': 70 };

        // Then - one refusal per metric that fell, and none for those that held
        expect(checkCoverageFloor(FLOOR, now, 'all')).toStrictEqual([
            `found: \`all/branches\` fell to 69.50, below its floor of 70.00 · why: a floor only rises, so what the project reached is never lost unseen · fix: raise it back, or lower the floor by hand in a commit that says why · ${READ}`,
            `found: \`all/lines\` fell to 70.00, below its floor of 76.00 · why: a floor only rises, so what the project reached is never lost unseen · fix: raise it back, or lower the floor by hand in a commit that says why · ${READ}`,
        ]);
    });

    test('coverage-floor — a scope with no floor — is refused in its own words', () => {
        // Given - a run of a scope the section records no floor for
        // Then - the missing floor is named, rather than read as a pass
        expect(checkCoverageFloor(undefined, FLOOR, 'all')).toStrictEqual([
            `found: jterrazz.baseline.json › test.coverage holds no \`all\` floor · why: a scope with no floor is held to nothing, so its coverage could fall unseen · fix: run \`npm run coverage\`, which records the floor the suite reached · ${READ}`,
        ]);
    });

    test('coverage-floor — what the count reaches — the child processes the suite spawns (meta-test) — every child is counted, and judged on the source its bundle maps back to', async () => {
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

    test('coverage-floor — what the count reaches — the child processes the suite spawns (meta-test) — every bundle carries the map back to its modules, and the tarball none of them', async () => {
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
