import { readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import type { Finding } from '../../engine/checker/finding.js';
import { SHARED_FOLDER } from '../../engine/project/ground.js';
import { specimenOf } from '../../engine/project/specimen.js';
import { suppressedLines } from '../../engine/project/suppression.js';
import { listFiles } from '../../engine/project/tree.js';
import { FACET_MATRIX_COLUMNS } from '../corpus/facet-matrix.js';
import { matrixCapabilityFolders } from '../corpus/matrix.js';
import type { SelfPassId } from './checker.js';

const COMPONENT = 'component';

const RENDERED = /\.tsx?$/u;

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

/** A first-level folder that is no facet — a repository suite — has no column, and takes a capability of any. */
function vocabularyOf(facet: string): Set<string> {
    const column = FACET_MATRIX_COLUMNS.find((name) => name === facet && name !== 'module');
    if (column !== undefined) {
        return matrixCapabilityFolders(column);
    }
    const any = new Set<string>();
    for (const name of FACET_MATRIX_COLUMNS) {
        for (const folder of matrixCapabilityFolders(name)) {
            any.add(folder);
        }
    }
    return any;
}

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

function foldersBelowFacet(specsRoot: string, file: string): string[] {
    return relative(specsRoot, dirname(file)).split(sep).slice(1);
}

function fixOf(facet: string, shape: string, vocabulary: Set<string>, beside = ''): string {
    return `file it under the capability it specifies, one folder below its facet — \`${facet}/<capability>/${shape}\`${beside}, the capability a name the matrix gives the \`${facet}\` column, kebab-cased (\`${EXAMPLES.filter((name) => vocabulary.has(name)).join('`, `')}\`, …; docs/03-testing.md § The capability matrix)`;
}

function checkComponentTree(specsRoot: string): Finding<SelfPassId>[] {
    const vocabulary = matrixCapabilityFolders(COMPONENT);
    return listFiles(join(specsRoot, COMPONENT), (path) => RENDERED.test(path)).flatMap((file) => {
        const folders = foldersBelowFacet(specsRoot, file);
        const [folder = ''] = folders;
        const text = readFileSync(file, 'utf8');
        const line = firstCodeLine(text);
        if (
            (folders.length === 1 && vocabulary.has(folder)) ||
            suppressedLines(text, 'specimen-filed-by-capability').has(line)
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
                rule: 'specimen-filed-by-capability' as const,
            },
        ];
    });
}

/** Reported at the file's first line of code, so a `checker-disable-next-line specimen-filed-by-capability -- <reason>` above it silences the finding. */
export function checkSpecimenFiledByCapability(specsRoot: string): Finding<SelfPassId>[] {
    return [...checkSpecimenSpecs(specsRoot), ...checkComponentTree(specsRoot)];
}

function checkSpecimenSpecs(specsRoot: string): Finding<SelfPassId>[] {
    return listFiles(specsRoot, (path) => path.endsWith('.spec.ts')).flatMap((file) => {
        const [facet = ''] = relative(specsRoot, file).split(sep);
        if (facet === SHARED_FOLDER) {
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
            suppressedLines(text, 'specimen-filed-by-capability').has(line)
        ) {
            return [];
        }
        const shown = relative(specsRoot, dirname(file)).split(sep).join('/');
        return [
            {
                file: relative(specsRoot, file).split(sep).join('/'),
                fix: fixOf(facet, '<aspect>.spec.ts', vocabulary),
                found: `a spec of the specimen \`${specimen}\`, filed under \`${shown}/\``,
                line,
                rule: 'specimen-filed-by-capability' as const,
            },
        ];
    });
}
