import { readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { SHARED_GROUND } from '../src/kernel/files/ground.js';
import { listFiles, suppressedLines } from './checker-crossfile.js';
import type { TokenViolation } from './checker.js';
import { COLUMNS } from './facet-matrix.js';
import { capabilityFolders } from './matrix.js';
import { specimenOf } from './specimen.js';

/**
 * C35 — a spec of a specimen is filed by the capability it specifies.
 *
 * A spec whose runner drives an app under `specs/shared/fixtures/`
 * (`lint/specimen.ts`) specifies the FRAMEWORK, not that app: its folder is
 * the capability it asks about, one below its facet —
 * `specs/api/seed/<aspect>.spec.ts` — named from the capability matrix's
 * column for that facet, a closed vocabulary (`lint/matrix.ts`), and its file
 * the aspect asked of it.
 *
 * The component facet's tree IS its fixture app, and it is filed the same
 * way: each rendered unit, with the `.test.tsx` beside it, sits under the
 * capability that test specifies, from the `component` column —
 * `specs/component/intercept/post-table.tsx`.
 */

/** The facet whose tree is the app its tests render, filed by capability file by file. */
const COMPONENT = 'component';

/** What the component tree holds: rendered units, the hooks and DOM functions a test hosts, their tests. */
const RENDERED = /\.tsx?$/u;

/** The capabilities a finding names as the first to reach for, those of the facet's column. */
const EXAMPLES = [
    'seed',
    'intercept',
    'clock',
    'to-match',
    'get',
    'exec',
    'trigger',
    'call',
    'visit',
    'open',
];

/**
 * The folders a facet files a specimen's spec under: its column's. A
 * first-level folder that is no facet — a repository suite — has no column,
 * and takes a capability of any.
 */
function vocabularyOf(facet: string): Set<string> {
    const column = COLUMNS.find((name) => name === facet && name !== 'module');
    if (column !== undefined) {
        return capabilityFolders(column);
    }
    const any = new Set<string>();
    for (const name of COLUMNS) {
        for (const folder of capabilityFolders(name)) {
            any.add(folder);
        }
    }
    return any;
}

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

/** The fix a misfiled file is told: the shape of its path, and the column's words for it. */
function fixOf(facet: string, shape: string, vocabulary: Set<string>, beside = ''): string {
    return `file it under the capability it specifies, one folder below its facet — \`${facet}/<capability>/${shape}\`${beside}, the capability a name the matrix gives the \`${facet}\` column, kebab-cased (\`${EXAMPLES.filter((name) => vocabulary.has(name)).join('`, `')}\`, …; docs/03-testing.md § The capability matrix)`;
}

/**
 * Every file of the component tree outside a capability folder of the
 * `component` column, or more than one folder below it.
 */
function checkComponentTree(specsRoot: string): TokenViolation[] {
    const vocabulary = capabilityFolders(COMPONENT);
    return listFiles(join(specsRoot, COMPONENT), (path) => RENDERED.test(path)).flatMap((file) => {
        const folders = foldersBelowFacet(specsRoot, file);
        const [folder = ''] = folders;
        const text = readFileSync(file, 'utf8');
        const line = firstCodeLine(text);
        if (
            (folders.length === 1 && vocabulary.has(folder)) ||
            suppressedLines(text, 'c35').has(line)
        ) {
            return [];
        }
        const shown = relative(specsRoot, dirname(file)).split(sep).join('/');
        return [
            {
                file: relative(specsRoot, file).split(sep).join('/'),
                fix: fixOf(
                    COMPONENT,
                    '<unit>.test.tsx',
                    vocabulary,
                    ' beside the `<unit>.tsx` it renders',
                ),
                found: `a file of the component tree, filed under \`${shown}/\``,
                line,
                rule: 'c35-capability-folder' as const,
                severity: 'error' as const,
            },
        ];
    });
}

/**
 * CONVENTIONS C35 — every `.spec.ts` reaching a specimen, and every file of
 * the component tree, sits one folder below its facet, in a folder the
 * capability matrix names. Reported at the file's first line of code, where
 * `checker-disable-next-line c35 -- <reason>` above it silences the finding.
 */
export function checkCapabilityFolder(specsRoot: string): TokenViolation[] {
    return [...checkSpecimenSpecs(specsRoot), ...checkComponentTree(specsRoot)];
}

/** Every `.spec.ts` reaching a specimen outside a capability folder of its facet's column. */
function checkSpecimenSpecs(specsRoot: string): TokenViolation[] {
    return listFiles(specsRoot, (path) => path.endsWith('.spec.ts')).flatMap((file) => {
        const [facet = ''] = relative(specsRoot, file).split(sep);
        if (facet === SHARED_GROUND) {
            return [];
        }
        const text = readFileSync(file, 'utf8');
        const specimen = specimenOf(file, text, facet);
        const vocabulary = vocabularyOf(facet);
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
                fix: fixOf(facet, '<aspect>.spec.ts', vocabulary),
                found: `a spec of the specimen \`${SHARED_GROUND}/fixtures/${specimen}\`, filed under \`${shown}/\``,
                line,
                rule: 'c35-capability-folder' as const,
                severity: 'error' as const,
            },
        ];
    });
}
