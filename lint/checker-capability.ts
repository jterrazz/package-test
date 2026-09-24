import { readFileSync } from 'node:fs';
import { dirname, relative, sep } from 'node:path';

import { SHARED_GROUND } from '../src/model/chain/ground.js';
import { listFiles, suppressedLines } from './checker-crossfile.js';
import type { TokenViolation } from './checker.js';
import { capabilityFolders } from './matrix.js';
import { specimenOf } from './specimen.js';

/**
 * C35 — a spec of a specimen is filed by the capability it specifies.
 *
 * A spec whose runner drives an app under `specs/shared/fixtures/`
 * (`lint/specimen.ts`) specifies the FRAMEWORK, not that app: its folder is
 * the capability it asks about, one below its facet —
 * `specs/api/seed/<aspect>.spec.ts` — named from the capability matrix, a
 * closed vocabulary (`lint/matrix.ts`), and its file the aspect asked of it.
 */

/** The capabilities a finding names as the first to reach for. */
const EXAMPLES = ['seed', 'intercept', 'clock', 'to-match', 'get', 'exec', 'trigger'];

/** The 1-based line of a file's first code — past the comments and blank lines it opens on. */
function firstCodeLine(text: string): number {
    const lines = text.split('\n');
    let inBlock = false;
    for (const [index, raw] of lines.entries()) {
        const line = raw.trim();
        if (inBlock) {
            inBlock = !line.includes('*/');
        } else if (line.startsWith('/*')) {
            inBlock = !line.includes('*/');
        } else if (line !== '' && !line.startsWith('//')) {
            return index + 1;
        }
    }
    return 1;
}

/** The folders of a path below the facet folder, the file's own name aside. */
function foldersBelowFacet(specsRoot: string, file: string): string[] {
    return relative(specsRoot, dirname(file)).split(sep).slice(1);
}

/**
 * CONVENTIONS C35 — every `.spec.ts` reaching a specimen sits one folder below
 * its facet, in a folder the capability matrix names. Reported at the file's
 * first line of code, where `checker-disable-next-line c35 -- <reason>` above
 * it silences the finding.
 */
export function checkCapabilityFolder(specsRoot: string): TokenViolation[] {
    const vocabulary = capabilityFolders();
    return listFiles(specsRoot, (path) => path.endsWith('.spec.ts')).flatMap((file) => {
        const [facet = ''] = relative(specsRoot, file).split(sep);
        if (facet === SHARED_GROUND) {
            return [];
        }
        const text = readFileSync(file, 'utf8');
        const specimen = specimenOf(file, text);
        const folders = foldersBelowFacet(specsRoot, file);
        const [folder = ''] = folders;
        const line = firstCodeLine(text);
        if (
            specimen === undefined ||
            (folders.length === 1 && vocabulary.has(folder)) ||
            suppressedLines(text, 'c35').has(line)
        ) {
            return [];
        }
        const shown = relative(specsRoot, dirname(file)).split(sep).join('/');
        return [
            {
                file: relative(specsRoot, file).split(sep).join('/'),
                fix: `file it under the capability it specifies, one folder below its facet — \`${facet}/<capability>/<aspect>.spec.ts\`, the capability a name of the matrix kebab-cased (\`${EXAMPLES.join('`, `')}\`, …; docs/03-testing.md § The capability matrix)`,
                found: `a spec of the specimen \`${SHARED_GROUND}/fixtures/${specimen}\`, filed under \`${shown}/\``,
                line,
                rule: 'c35-capability-folder' as const,
                severity: 'error' as const,
            },
        ];
    });
}
