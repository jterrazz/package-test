import { isSpecialFolder } from '@jterrazz/typescript/rules';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import type { Spotted } from '../../kit/checker/registry.js';
import { specimenOf } from '../../kit/project/specimen.js';
import { suppressedLines } from '../../kit/project/suppression.js';
import { listFiles } from '../../kit/project/tree.js';
import { matrixCapabilityFolders } from '../corpus/matrix.js';
import { SPECIFICATION_MATRIX_COLUMNS } from '../corpus/specification-matrix.js';
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

/** A first-level folder that is no specification — a repository suite — has no column, and takes a capability of any. */
function vocabularyOf(specification: string): Set<string> {
    const column = SPECIFICATION_MATRIX_COLUMNS.find(
        (name) => name === specification && name !== 'module',
    );
    if (column !== undefined) {
        return matrixCapabilityFolders(column);
    }
    const any = new Set<string>();
    for (const name of SPECIFICATION_MATRIX_COLUMNS) {
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

function foldersBelowSpecification(specsRoot: string, file: string): string[] {
    return relative(specsRoot, dirname(file)).split(sep).slice(1);
}

function fixOf(specification: string, shape: string, vocabulary: Set<string>, beside = ''): string {
    return `file it under the capability it specifies, one folder below its specification — \`${specification}/<capability>/${shape}\`${beside}, the capability a name the matrix gives the \`${specification}\` column, kebab-cased (\`${EXAMPLES.filter((name) => vocabulary.has(name)).join('`, `')}\`, …; docs/guides/test.md § The capability matrix)`;
}

function checkComponentTree(specsRoot: string): Spotted<SelfPassId>[] {
    const vocabulary = matrixCapabilityFolders(COMPONENT);
    return listFiles(join(specsRoot, COMPONENT), (path) => RENDERED.test(path)).flatMap((file) => {
        const folders = foldersBelowSpecification(specsRoot, file);
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
                path: relative(specsRoot, file).split(sep).join('/'),
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
export function checkSpecimenFiledByCapability(specsRoot: string): Spotted<SelfPassId>[] {
    return [...checkSpecimenSpecs(specsRoot), ...checkComponentTree(specsRoot)];
}

function checkSpecimenSpecs(specsRoot: string): Spotted<SelfPassId>[] {
    return listFiles(specsRoot, (path) => path.endsWith('.spec.ts')).flatMap((file) => {
        const [specification = ''] = relative(specsRoot, file).split(sep);
        if (isSpecialFolder(specification)) {
            return [];
        }
        const text = readFileSync(file, 'utf8');
        const specimen = specimenOf(file, text, specification);
        const vocabulary = vocabularyOf(specification);
        const folders = foldersBelowSpecification(specsRoot, file);
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
                path: relative(specsRoot, file).split(sep).join('/'),
                fix: fixOf(specification, '<aspect>.spec.ts', vocabulary),
                found: `a spec of the specimen \`${specimen}\`, filed under \`${shown}/\``,
                line,
                rule: 'specimen-filed-by-capability' as const,
            },
        ];
    });
}
