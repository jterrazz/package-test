import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../checker-cli.specification.js';

describe('ratchet', () => {
    test('lint — checker CLI, the ratchet is exact — `--fix` settles a JSON root that extends a commented JSON, and a `.jsonc` subtree, in one run', async () => {
        // Given - two trees the plugin's fixes rewrite: the root's `.oxlintrc.json` extends a commented JSON, and a commented `.oxlintrc.jsonc` governs web/, laid down before the checker starts
        const result = await cli
            .env({ NODE_OPTIONS: '--import=$WORKDIR/lay-configs.mjs' })
            .fixture(directory('./__fixtures__/checker-own-fixes-json/'))
            .exec(['baseline .', '. --fix']);

        // Then - both views written, and the section (the checker's passes alone) holds nothing
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toBe('.jterrazz/baseline.json › test: nothing held\n');
        expect(result.file('specs/api/events/list/pagination.spec.ts').content).toContain(
            "const events = api.with({ clock: '2026-03-04T09:30:00Z' });",
        );
        expect(result.file('web/specs/api/events/list/pagination.spec.ts').content).toContain(
            "const events = api.with({ clock: '2026-03-04T09:30:00Z' });",
        );
    });

    test('lint — checker CLI, the ratchet is exact — a green run over a section that holds nothing prints `nothing held`', async () => {
        // Given - a clean project, recorded (nothing to hold, so no ledger), then judged
        const result = await cli
            .fixture(directory('../../__fixtures__/no-unused-ground-ok/'))
            .exec(['baseline .', '.']);

        // Then - the same line as a project that keeps no section, never a count of nothing
        expect(result.exitCode).toBe(0);
        expect(result.file('.jterrazz/baseline.json').exists).toBe(false);
        expect(result.stdout.text).toBe('.jterrazz/baseline.json › test: nothing held\n');
    });
});
