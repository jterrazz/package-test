import { readSettings, readSettingsSync } from '@jterrazz/typescript/rules';

import { testSettingsOf } from './test-section.js';
import type { ReadTestSettings } from './test-section.js';

/** Every pass is sync, so the file is loaded synchronously, once per process; the runtime reads the same resolution, so the run and the checker agree. A file that does not resolve is no settings: the toolchain already reports it. */
export const testSettingsAt = (root: string): ReadTestSettings =>
    testSettingsOf(readSettingsSync(root).resolved.sections.test);

export async function testSectionAt(root: string): Promise<ReadTestSettings> {
    const { resolved } = await readSettings(root);
    return testSettingsOf(resolved.sections.test);
}
