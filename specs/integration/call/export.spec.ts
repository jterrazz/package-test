import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { directory, file } from '../../../src/index.js';
import { exportOrders } from '../../shared/fixtures/orders/orders.js';
import { integration } from '../integration.specification.js';

describe('export', () => {
    test('reads the tree and the file a module wrote, wherever it wrote them', async () => {
        // Given - two orders, exported by the module into a directory of its own
        const out = mkdtempSync(join(tmpdir(), 'orders-export-'));
        try {
            const result = await integration
                .seed(file('./seeds/two-orders.sql'))
                .call(async ({ db }) => {
                    await exportOrders(db.connectionString, out);
                });

            // Then - the tree is the golden one, and its summary reads as a file of it
            await expect(result.directory(out)).toMatch(directory('./expected/export/'));
            expect(result.file(join(out, 'summary.txt')).content).toBe('2 orders\n');
        } finally {
            rmSync(out, { force: true, recursive: true });
        }
    });
});
